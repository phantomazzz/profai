import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeScores, type AnsweredQuestion } from '../scoring/index.js';
import { filterProfessions, type ProfessionLike } from '../professions/filter.js';
import { SEED_QUESTIONS } from '@profai/shared';
import { MockLlmProvider } from '../llm/providers/mock.js';
import {
  runDraftPersona,
  runFinalReport,
  FabricatedIdError,
} from '../llm/orchestrator.js';
import type { LlmProvider, LlmRequest } from '../llm/provider.js';
import type { ReportContext } from '../llm/report-generator.js';
import { buildDraftPersona } from '../llm/report-generator.js';

const raw = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../prisma/seed-data/professions.json', import.meta.url)),
    'utf-8',
  ),
) as { professions: { id: string; title: string; riasec_code: string; trait_tags: string[] }[] };

const professions: ProfessionLike[] = raw.professions.map((p) => ({
  id: p.id,
  riasecCode: p.riasec_code,
  traitTags: p.trait_tags,
}));
const titleById = new Map(raw.professions.map((p) => [p.id, p.title]));

function buildContext(): ReportContext {
  const answers: AnsweredQuestion[] = SEED_QUESTIONS.map((q) => ({
    block: q.block,
    scaleKey: q.scaleKey,
    isReverse: q.isReverse,
    rawValue: q.scaleType === 'RIASEC_4' ? 3 : 4,
  }));
  const scoring = computeScores(answers);
  const shortlist = filterProfessions(professions, scoring.hollandCode, scoring.topFactorKeys);

  const toProf = (s: { professionId: string; letterMatch: number; traitOverlap: number }) => ({
    id: s.professionId,
    title: titleById.get(s.professionId) ?? s.professionId,
    letterMatch: s.letterMatch,
    traitOverlap: s.traitOverlap,
  });

  return {
    personalRequest: 'Хочу сменить сферу и зарабатывать больше, занимаясь осмысленным делом.',
    draftPersona: buildDraftPersona({ openAnswers: [], personalRequest: 'смена сферы' }),
    scores: scoring.scores,
    hollandCode: scoring.hollandCode,
    suitable: shortlist.suitable.map(toProf),
    unsuitable: shortlist.unsuitable.map(toProf),
    age: 32,
  };
}

describe('LLM-оркестрация на мок-провайдере', () => {
  const provider = new MockLlmProvider();

  it('runDraftPersona возвращает валидный по схеме черновой портрет', async () => {
    const persona = await runDraftPersona(provider, {
      openAnswers: [
        { question: 'Чем занимаешься?', text: 'Работаю в поддержке, выгораю.' },
        { question: 'Что даётся легко?', text: 'Разбираться в проблемах людей.' },
      ],
      personalRequest: 'Хочу другую работу.',
    });
    expect(persona.predicted_type).toBeTruthy();
    expect(persona.reframed_request).toBeTruthy();
    expect(persona.tentative_themes.length).toBeGreaterThan(0);
    // цитата берётся из первого непустого ответа
    expect(persona.notable_quotes?.[0]).toContain('поддержке');
  });

  it('runFinalReport собирает валидный по схеме финальный отчёт', async () => {
    const ctx = buildContext();
    const report = await runFinalReport(provider, ctx);

    expect(report.personality_traits).toHaveLength(16);
    expect(report.next_steps.weekly_plan).toHaveLength(4);
    expect(report.career.holland_code).toBe(ctx.hollandCode);
    expect(report.career.riasec_profile).toHaveLength(6);
    expect(report.motivation.breakdown).toHaveLength(5);
    expect(report.career.suitable_professions.length).toBeGreaterThanOrEqual(4);
  });

  it('id профессий в отчёте — только из переданного шорт-листа', async () => {
    const ctx = buildContext();
    const report = await runFinalReport(provider, ctx);
    const allowed = new Set([...ctx.suitable, ...ctx.unsuitable].map((p) => p.id));
    for (const p of report.career.suitable_professions) {
      expect(allowed.has(p.profession_id)).toBe(true);
    }
  });

  it('битый ответ модели для черновика → детерминированный фолбэк (не роняет пайплайн)', async () => {
    const brokenProvider: LlmProvider = {
      name: 'broken',
      async generateStructured() {
        return {}; // пустой объект не пройдёт схему draft_persona
      },
    };
    // черновик — внутренний артефакт: вместо throw возвращаем валидный фолбэк
    const persona = await runDraftPersona(brokenProvider, {
      openAnswers: [{ question: 'Чем занимаешься?', text: 'Работаю в поддержке.' }],
      personalRequest: 'x',
    });
    expect(persona.predicted_type).toBeTruthy();
    expect(persona.tentative_strengths.length).toBeGreaterThan(0);
    expect(persona.tone_notes).toBeTruthy();
  });

  it('пропущенный personality_map у модели → бэкфилл, отчёт остаётся валидным', async () => {
    const ctx = buildContext();
    // модель вернула секцию личности без personality_map (наблюдали на проде)
    const stripping: LlmProvider = {
      name: 'stripping',
      async generateStructured(req: LlmRequest) {
        const r = (await provider.generateStructured(req)) as Record<string, unknown>;
        delete r.personality_map;
        return r;
      },
    };
    const report = await runFinalReport(stripping, ctx);
    expect(report.personality_map).toBeTruthy();
    expect(typeof report.personality_map.narrative).toBe('string');
    expect(report.personality_map.key_characteristics.length).toBeGreaterThan(0);
    expect(report.personality_traits).toHaveLength(16);
  });

  it('битый ответ модели для секций финала ловится валидацией схемы', async () => {
    const ctx = buildContext();
    const brokenProvider: LlmProvider = {
      name: 'broken',
      async generateStructured() {
        return {}; // секции финала обязаны заполнить схему — иначе ошибка
      },
    };
    await expect(runFinalReport(brokenProvider, ctx)).rejects.toThrow(/валидаци/);
  });

  it('выдуманный id профессии ловится guardrail-ом', async () => {
    const ctx = buildContext();
    // провайдер-обёртка: подменяет profession_id в секции career на «выдуманный»
    const tampering: LlmProvider = {
      name: 'tampering',
      async generateStructured(req: LlmRequest) {
        const result = (await provider.generateStructured(req)) as Record<string, unknown>;
        if (result.career) {
          const career = result.career as { suitable_professions: { profession_id: string }[] };
          career.suitable_professions[0]!.profession_id = 'profession-does-not-exist';
        }
        return result;
      },
    };
    await expect(runFinalReport(tampering, ctx)).rejects.toBeInstanceOf(FabricatedIdError);
  });
});

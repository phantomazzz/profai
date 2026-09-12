/**
 * Оркестрация двух вызовов LLM.
 * Вызов 1: draft_persona (фоновый). Вызов 2: final_report, собирается из
 * параллельных под-вызовов по секциям (product_context.md §5), затем
 * валидируется против схемы и проверяется на «выдуманные» id.
 */
import { GERCHIKOV_TYPES, RIASEC_TYPES, type DraftPersona, type FinalReport } from '@profai/shared';
import type { LlmProvider } from './provider.js';
import { validateAgainstSchema, validateSectionData } from './validation.js';
import { draftPersonaSchema, sectionSchemas } from './schemas.js';
import { buildDraftPersonaPrompt, buildSectionPrompt } from './prompts.js';
import { FINAL_SECTIONS, buildDraftPersona, type ReportContext, type FinalSection } from './report-generator.js';
import type { MockContext } from './providers/mock.js';

export interface DraftPersonaInput {
  openAnswers: { question: string; text: string }[];
  personalRequest: string;
  profileHint?: string;
}

/**
 * Черновой портрет (Job 1, обычно на дешёвой модели). Слабые модели иногда
 * заполняют схему частично, поэтому: ретрай с корректирующей подсказкой, а при
 * стойком провале — детерминированный фолбэк (черновик — внутренний артефакт,
 * из-за него не роняем весь дорогой отчёт).
 */
export async function runDraftPersona(
  provider: LlmProvider,
  input: DraftPersonaInput,
): Promise<DraftPersona> {
  const { system, user } = buildDraftPersonaPrompt(input);
  const context: MockContext = {
    kind: 'draft',
    openAnswers: input.openAnswers,
    personalRequest: input.personalRequest,
  };

  let lastErr = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const fix =
      attempt === 0
        ? ''
        : `\n\nПредыдущий ответ не прошёл проверку: ${lastErr}. Верни ВСЕ обязательные поля; поля-массивы (tentative_themes, tentative_strengths, tentative_concerns, notable_quotes) — именно массивы строк.`;
    try {
      const raw = await provider.generateStructured({
        system,
        user: user + fix,
        jsonSchema: draftPersonaSchema,
        schemaName: 'draft_persona',
        context,
      });
      return validateAgainstSchema<DraftPersona>('draft_persona', raw);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  console.warn(`⚠ draft_persona не прошёл валидацию после ретраев (${lastErr}). Использую детерминированный черновик.`);
  return buildDraftPersona(input);
}

export class FabricatedIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FabricatedIdError';
  }
}

/** Проверка: LLM не выдумала id профессий/книг вне переданных списков. */
function assertNoFabricatedIds(
  report: FinalReport,
  allowedProfessionIds: Set<string>,
  allowedBookIds: Set<string>,
): void {
  const bad: string[] = [];
  for (const p of report.career.suitable_professions) {
    if (!allowedProfessionIds.has(p.profession_id)) bad.push(`suitable:${p.profession_id}`);
  }
  for (const p of report.career.unsuitable_professions) {
    if (!allowedProfessionIds.has(p.profession_id)) bad.push(`unsuitable:${p.profession_id}`);
  }
  const bookIds = [
    ...report.potential.strengths.map((s) => s.book_recommendation_id),
    ...report.potential.growth_areas.map((g) => g.book_recommendation_id),
  ].filter((id) => id !== ''); // пустой = «книга не выбрана» (библиотека пока пуста)
  for (const id of bookIds) {
    if (!allowedBookIds.has(id)) bad.push(`book:${id}`);
  }
  if (bad.length > 0) {
    throw new FabricatedIdError(`LLM сослалась на id вне разрешённых списков: ${bad.join(', ')}`);
  }
}

export interface FinalReportOptions {
  allowedBookIds?: string[];
}

/**
 * Детерминированная подстановка чисел: проценты и код Холланда берём из
 * посчитанных баллов, а не из того, что сгенерировала модель (числа должны
 * быть точными; модель отвечает только за текст).
 */
function hydrateDeterministic(report: FinalReport, ctx: ReportContext): FinalReport {
  const byCat = (cat: string) =>
    Object.fromEntries(ctx.scores.filter((s) => s.category === cat).map((s) => [s.scaleKey, s.percent]));
  const pers = byCat('PERSONALITY');
  const gerch = byCat('GERCHIKOV');
  const pink = byCat('PINK');
  const riasec = byCat('RIASEC');

  report.personality_traits = report.personality_traits.map((t) => ({
    ...t,
    percent: pers[t.factor_key] ?? t.percent,
  }));
  report.motivation.breakdown = report.motivation.breakdown.map((b) => ({
    ...b,
    percent: gerch[b.type_key] ?? b.percent,
  }));
  report.motivation.motivators.autonomy_percent = pink['autonomy'] ?? report.motivation.motivators.autonomy_percent;
  report.motivation.motivators.mastery_percent = pink['mastery'] ?? report.motivation.motivators.mastery_percent;
  report.motivation.motivators.purpose_percent = pink['purpose'] ?? report.motivation.motivators.purpose_percent;
  report.career.riasec_profile = report.career.riasec_profile.map((r) => ({
    ...r,
    percent: riasec[r.type_key] ?? r.percent,
  }));
  report.career.holland_code = ctx.hollandCode;

  // books_library пока пуст — обнуляем book_recommendation_id (нечего рендерить).
  // Когда библиотека появится, заменить на проверку по allowedBookIds.
  report.potential.strengths = report.potential.strengths.map((s) => ({ ...s, book_recommendation_id: '' }));
  report.potential.growth_areas = report.potential.growth_areas.map((g) => ({ ...g, book_recommendation_id: '' }));
  return report;
}

/**
 * Приводит массив 16 черт ровно к известным факторам (по данным скоринга),
 * сохраняя текст модели. Устраняет типичный сбой «модель выдала >16 черт».
 */
function normalizeSection(
  section: FinalSection,
  raw: Record<string, unknown>,
  ctx: ReportContext,
): Record<string, unknown> {
  const scorePct = (cat: string, key: string) =>
    ctx.scores.find((s) => s.category === cat && s.scaleKey === key)?.percent;

  if (section === 'personality') {
    const modelTraits = Array.isArray(raw.personality_traits)
      ? (raw.personality_traits as Record<string, unknown>[])
      : [];
    const byKey = new Map(modelTraits.map((t) => [String(t.factor_key), t]));
    const persScores = ctx.scores.filter((s) => s.category === 'PERSONALITY');

    raw.personality_traits = persScores.map((s) => {
      const t = byKey.get(s.scaleKey);
      const recs = Array.isArray(t?.recommendations) ? (t!.recommendations as string[]).slice(0, 3) : [];
      while (recs.length < 2) recs.push('Обрати внимание, как эта черта проявляется в работе.');
      return {
        factor_key: s.scaleKey,
        percent: s.percent,
        description: (t?.description as string) ?? `Фактор проявлен на ${s.percent}%.`,
        interpretation: (t?.interpretation as string) ?? 'Учитывай этот уровень при выборе задач.',
        recommendations: recs,
      };
    });
    return raw;
  }

  // Мотивация: ровно 5 типов Герчикова (модель может вернуть меньше/больше/в др. ключах).
  if (section === 'motivation' && raw.motivation && typeof raw.motivation === 'object') {
    const mot = raw.motivation as Record<string, unknown>;
    const items = Array.isArray(mot.breakdown) ? (mot.breakdown as Record<string, unknown>[]) : [];
    const byKey = new Map(items.map((b) => [String(b.type_key), b]));
    mot.breakdown = GERCHIKOV_TYPES.map((t) => {
      const b = byKey.get(t.key);
      const percent = scorePct('GERCHIKOV', t.key) ?? (typeof b?.percent === 'number' ? (b.percent as number) : 0);
      return {
        type_key: t.key,
        percent,
        description: (b?.description as string) ?? `Тип «${t.label}» — ${percent}%.`,
        ...(b?.example_person ? { example_person: b.example_person as string } : {}),
      };
    });
    return raw;
  }

  // Карьера: ровно 6 типов RIASEC в профиле.
  if (section === 'career' && raw.career && typeof raw.career === 'object') {
    const car = raw.career as Record<string, unknown>;
    const items = Array.isArray(car.riasec_profile) ? (car.riasec_profile as Record<string, unknown>[]) : [];
    const byKey = new Map(items.map((r) => [String(r.type_key), r]));
    car.riasec_profile = RIASEC_TYPES.map((t) => {
      const r = byKey.get(t.key);
      const percent = scorePct('RIASEC', t.key) ?? (typeof r?.percent === 'number' ? (r.percent as number) : 0);
      return { type_key: t.key, percent };
    });
    return raw;
  }

  return raw;
}

/** Генерация одной секции с ретраем при несоответствии её схеме. */
async function generateSection(
  provider: LlmProvider,
  section: FinalSection,
  ctx: ReportContext,
): Promise<Record<string, unknown>> {
  const { system, user } = buildSectionPrompt(section, ctx);
  const jsonSchema = sectionSchemas[section];
  const context: MockContext = { kind: 'section', section, reportContext: ctx };

  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const fix =
      attempt === 0
        ? ''
        : `\n\nПредыдущий ответ не прошёл проверку: ${lastErrors.join('; ')}. Заполни ВСЕ обязательные поля и соблюдай минимальное количество элементов в массивах.`;
    const raw = normalizeSection(
      section,
      (await provider.generateStructured({
        system,
        user: user + fix,
        jsonSchema,
        schemaName: 'final_report',
        context,
      })) as Record<string, unknown>,
      ctx,
    );
    lastErrors = validateSectionData(section, raw);
    if (lastErrors.length === 0) return raw;
  }
  throw new Error(`Секция «${section}» не прошла валидацию после ретраев:\n${lastErrors.join('\n')}`);
}

export async function runFinalReport(
  provider: LlmProvider,
  ctx: ReportContext,
  options: FinalReportOptions = {},
): Promise<FinalReport> {
  // Параллельные посекционные вызовы — маленькие схемы надёжнее заполняются.
  const parts = await Promise.all(FINAL_SECTIONS.map((s) => generateSection(provider, s, ctx)));
  const merged = parts.reduce<Record<string, unknown>>((acc, p) => Object.assign(acc, p), {});

  let report = validateAgainstSchema<FinalReport>('final_report', merged);
  report = hydrateDeterministic(report, ctx);

  const allowedProfessionIds = new Set([...ctx.suitable, ...ctx.unsuitable].map((p) => p.id));
  assertNoFabricatedIds(report, allowedProfessionIds, new Set(options.allowedBookIds ?? []));

  return report;
}

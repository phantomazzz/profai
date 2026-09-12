/**
 * Локальная проверка генерации отчёта на реальной модели (Sonnet 5) БЕЗ сервера и БД.
 * Строит правдоподобную персону (анкета + 5 открытых + полный набор закрытых
 * ответов под заданный профиль), прогоняет весь пайплайн (скоринг → шорт-лист →
 * draft (Haiku) → final (Sonnet, посекционно)) и печатает тайминги + расход токенов.
 *
 * Запуск:  npm run gen --workspace @profai/api
 * Результат сохраняется в apps/api/data/reports/<slug>.json и (для превью фронта)
 * в apps/web/src/report/live-sample.json.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SEED_QUESTIONS, OPEN_QUESTIONS } from '@profai/shared';
import { computeScores, type AnsweredQuestion } from '../scoring/index.js';
import { filterProfessions, type ProfessionLike } from '../professions/filter.js';
import { createLlmProvider } from '../llm/factory.js';
import { runDraftPersona, runFinalReport } from '../llm/orchestrator.js';
import type { ReportContext } from '../llm/report-generator.js';
import { usageLog } from '../llm/providers/anthropic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Персона: смена сферы «поддержка → аналитика данных» ──────────────────────
const profile: Record<string, string> = {
  age: '29',
  city: 'Москва',
  education: 'Высшее',
  occupation: 'Специалист поддержки',
  incomeRange: '80–120 тыс',
  supportLevel: 'Есть поддержка близких',
  personalRequest:
    'Хочу уйти из поддержки в аналитику данных, выйти на стабильный доход выше текущего и заниматься делом, где виден измеримый результат.',
};

const openAnswers: Record<string, string> = {
  open_1:
    'Работаю в поддержке SaaS-продукта: разбираю обращения, объясняю пользователям, где они ошиблись, эскалирую баги. День за днём — однообразно и выматывает: одни и те же тикеты, мало развития. По вечерам собираю дашборды по обращениям в Google Sheets — это единственная часть, которая по-настоящему увлекает.',
  open_2:
    'Легко даётся раскопать причину проблемы, найти закономерность в потоке обращений и объяснить это простыми словами. Тяжело — заявлять о себе, нетворкинг, доводить длинные сольные проекты до конца без внешних дедлайнов.',
  open_3:
    'Аналитический склад, довожу начатое до результата, спокоен в стрессовых ситуациях. Умею переводить сложное на понятный язык — коллеги часто приходят, чтобы я «объяснил по-человечески».',
  open_4:
    'Через несколько лет — продуктовый или дата-аналитик в устойчивой финтех-компании со стабильным доходом, свой небольшой инструмент для личной аналитики и нормальный баланс работы и жизни.',
  open_5:
    'Строил бы продукты, которые делают данные и личные финансы понятными обычным людям — чтобы цифры помогали принимать решения, а не пугали.',
};

// Желаемый уровень выраженности по шкалам (0..1). Остальные → 0.5.
const LEVEL: Record<string, number> = {
  // 16 факторов
  analyticity: 0.86, conscientiousness: 0.78, self_control: 0.7, self_reliance: 0.72,
  emotional_stability: 0.6, vigilance: 0.58, openness: 0.66, dominance: 0.5,
  diplomacy: 0.56, sensitivity: 0.42, sociability: 0.38, social_boldness: 0.46,
  expressiveness: 0.34, abstractedness: 0.48, apprehension: 0.56, tension: 0.5,
  // Герчиков
  professional: 0.82, master: 0.64, instrumental: 0.56, patriotic: 0.34, lumpen: 0.14,
  // Пинк
  autonomy: 0.8, mastery: 0.84, purpose: 0.72,
  // RIASEC
  R: 0.28, I: 0.9, A: 0.34, S: 0.32, E: 0.62, C: 0.72,
};
const lvl = (k: string) => LEVEL[k] ?? 0.5;

/**
 * Раздаёт n целых значений в [lo,hi] со средним ≈ target — чтобы внутри шкалы
 * ответы различались и итоговый процент не «квантовался» (как было бы при одном
 * значении на всю шкалу). Приближает поведение живого человека.
 */
function distribute(n: number, target: number, lo: number, hi: number): number[] {
  const base = Math.floor(target);
  const extra = Math.round((target - base) * n); // сколько вопросов получат base+1
  return Array.from({ length: n }, (_, i) =>
    Math.min(hi, Math.max(lo, i < extra ? base + 1 : base)),
  );
}

// ── Прогон ───────────────────────────────────────────────────────────────────
async function main() {
  const provider = createLlmProvider();
  const request = profile.personalRequest ?? '';
  console.log(`Провайдер: ${provider.name}\n`);
  if (provider.name === 'mock') {
    console.warn('⚠  LLM_PROVIDER/ключ не заданы — работает мок. Для реального прогона задай LLM_PROVIDER=anthropic и LLM_API_KEY.\n');
  }

  // 1. Закрытые ответы под персону (значения различаются внутри каждой шкалы)
  const groups = new Map<string, (typeof SEED_QUESTIONS)[number][]>();
  for (const q of SEED_QUESTIONS) {
    const k = `${q.block}|${q.scaleKey}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(q);
  }
  const valuesByGroup = new Map<string, number[]>(); // «в сторону выраженности» (adjusted / riasec-raw)
  for (const [k, qs] of groups) {
    const isRiasec = qs[0]!.scaleType === 'RIASEC_4';
    const L = lvl(qs[0]!.scaleKey);
    const target = isRiasec ? 1 + 3 * L : 1 + 4 * L;
    valuesByGroup.set(k, distribute(qs.length, target, 1, isRiasec ? 4 : 5));
  }
  const cursor = new Map<string, number>();
  const answers: AnsweredQuestion[] = SEED_QUESTIONS.map((q) => {
    const k = `${q.block}|${q.scaleKey}`;
    const i = cursor.get(k) ?? 0;
    cursor.set(k, i + 1);
    const v = valuesByGroup.get(k)![i]!;
    return {
      block: q.block,
      scaleKey: q.scaleKey,
      isReverse: q.isReverse,
      rawValue: q.scaleType === 'RIASEC_4' ? v : q.isReverse ? 6 - v : v,
    };
  });
  const scoring = computeScores(answers);
  console.log(`Код Холланда: ${scoring.hollandCode} · топ-факторы: ${scoring.topFactorKeys.join(', ')}`);
  if (process.env.GEN_NO_WRITE) {
    const pers = scoring.scores.filter((s) => s.category === 'PERSONALITY').sort((a, b) => b.percent - a.percent);
    console.log('Проценты личности:', pers.map((s) => `${s.scaleKey} ${s.percent}`).join(', '));
  }

  // 2. Шорт-лист профессий из seed-базы
  interface ProfessionRaw {
    id: string; title: string; riasec_code: string;
    income: { start: number; mid: number; max: number };
    growth_path: string; skills: string[]; companies: string[]; trait_tags: string[];
  }
  const professionsRaw = (
    JSON.parse(readFileSync(join(__dirname, '..', '..', 'prisma', 'seed-data', 'professions.json'), 'utf-8')) as {
      professions: ProfessionRaw[];
    }
  ).professions;
  const professionsLike: ProfessionLike[] = professionsRaw.map((p) => ({ id: p.id, riasecCode: p.riasec_code, traitTags: p.trait_tags }));
  const profById = new Map(professionsRaw.map((p) => [p.id, p]));
  const shortlist = filterProfessions(professionsLike, scoring.hollandCode, scoring.topFactorKeys);
  const toProf = (s: { professionId: string; letterMatch: number; traitOverlap: number }) => ({
    id: s.professionId,
    title: profById.get(s.professionId)?.title ?? s.professionId,
    letterMatch: s.letterMatch,
    traitOverlap: s.traitOverlap,
  });
  console.log(`Шорт-лист: подходящие ${shortlist.suitable.length}, неподходящие ${shortlist.unsuitable.length}\n`);

  // 3. Черновой портрет (Haiku)
  const tDraft = Date.now();
  const openForPrompt = OPEN_QUESTIONS.map((q) => ({ question: q.text, text: openAnswers[q.key] ?? '' }));
  const draftPersona = await runDraftPersona(provider, { openAnswers: openForPrompt, personalRequest: request });
  console.log(`✓ Черновой портрет (${draftPersona.predicted_type}) — ${Date.now() - tDraft}мс`);

  // 4. Финальный отчёт (Sonnet, посекционно)
  const ctx: ReportContext = {
    personalRequest: request,
    draftPersona,
    scores: scoring.scores,
    hollandCode: scoring.hollandCode,
    suitable: shortlist.suitable.map(toProf),
    unsuitable: shortlist.unsuitable.map(toProf),
    age: Number(profile.age),
  };
  const tFinal = Date.now();
  const report = await runFinalReport(provider, ctx);
  console.log(`✓ Финальный отчёт — ${Date.now() - tFinal}мс`);

  // 5. Справочник профессий для карточек
  const referenced = [...ctx.suitable, ...ctx.unsuitable].map((p) => p.id);
  const professions: Record<string, unknown> = {};
  for (const id of referenced) {
    const p = profById.get(id);
    if (p) professions[id] = { title: p.title, income: p.income, growthPath: p.growth_path, skills: p.skills, companies: p.companies };
  }

  // 6. Сохранение (GEN_NO_WRITE=1 — сухой прогон без записи файлов)
  const payload = { report, professions, request: request };
  const slug = Math.random().toString(36).slice(2, 8);
  if (process.env.GEN_NO_WRITE) {
    console.log(`\n(сухой прогон — файлы не сохранены)`);
  } else {
    const reportsDir = join(__dirname, '..', '..', 'data', 'reports');
    mkdirSync(reportsDir, { recursive: true });
    writeFileSync(join(reportsDir, `${slug}.json`), JSON.stringify(payload, null, 2), 'utf-8');
    const previewPath = join(__dirname, '..', '..', '..', 'web', 'src', 'report', 'live-sample.json');
    writeFileSync(previewPath, JSON.stringify({ report, professions }, null, 2), 'utf-8');
    console.log(`\nСохранено: data/reports/${slug}.json  и  apps/web/src/report/live-sample.json`);
  }

  // 7. Расход токенов и оценка стоимости (по вызовам провайдера)
  if (usageLog.length > 0) {
    const price: Record<string, { in: number; out: number }> = {
      'claude-sonnet-5': { in: 3, out: 15 },
      'claude-haiku-4-5': { in: 1, out: 5 },
    };
    let cost = 0, inTok = 0, outTok = 0, cacheTok = 0;
    for (const u of usageLog) {
      const pr = price[u.model] ?? { in: 3, out: 15 };
      cost += (u.inputTokens / 1e6) * pr.in + (u.outputTokens / 1e6) * pr.out;
      inTok += u.inputTokens; outTok += u.outputTokens; cacheTok += u.cacheReadTokens;
    }
    console.log(`\nВызовов LLM: ${usageLog.length} · вход ${inTok} ток. (из них кэш ${cacheTok}) · выход ${outTok} ток.`);
    console.log(`≈ стоимость прогона: $${cost.toFixed(4)}`);
  }

  // 8. Мини-проверка целостности
  const checks: [string, boolean][] = [
    ['16 факторов личности', report.personality_traits.length === 16],
    ['6 типов RIASEC', report.career.riasec_profile.length === 6],
    ['5 типов мотивации', report.motivation.breakdown.length === 5],
    ['4 недели плана', report.next_steps.weekly_plan.length === 4],
    ['≥4 подходящих профессий', report.career.suitable_professions.length >= 4],
    ['код Холланда из скоринга', report.career.holland_code === scoring.hollandCode],
  ];
  console.log('\nПроверка отчёта:');
  for (const [name, ok] of checks) console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  if (checks.some(([, ok]) => !ok)) process.exit(1);
}

main().catch((e) => {
  console.error('\n✗ Ошибка генерации:', e instanceof Error ? e.message : e);
  process.exit(1);
});

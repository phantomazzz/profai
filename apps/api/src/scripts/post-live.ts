/**
 * Дёргает ПРОД-эндпоинт POST /api/report реальным телом (персона + все закрытые
 * ответы с правильными ключами `block:scaleKey:orderIndex`), как это делает фронт.
 * Запуск:  TARGET_URL=https://profai-pgzd.onrender.com npx tsx src/scripts/post-live.ts
 */
import { SEED_QUESTIONS, OPEN_QUESTIONS } from '@profai/shared';

const TARGET = (process.env.TARGET_URL ?? '').replace(/\/$/, '');
if (!TARGET) throw new Error('нет TARGET_URL');

const profile: Record<string, string> = {
  age: '29', city: 'Москва', education: 'Высшее', occupation: 'Специалист поддержки',
  incomeRange: '80–120 тыс', supportLevel: 'Есть поддержка близких',
  personalRequest: 'Хочу уйти из поддержки в аналитику данных, выйти на стабильный доход выше текущего и заниматься делом, где виден измеримый результат.',
};
const openAnswers: Record<string, string> = {
  open_1: 'Работаю в поддержке SaaS-продукта: разбираю обращения, объясняю пользователям их ошибки, эскалирую баги. Однообразно и выматывает. По вечерам собираю дашборды по обращениям в Google Sheets — вот это увлекает.',
  open_2: 'Легко даётся раскопать причину и найти закономерность в данных, объяснить простыми словами. Тяжело — заявлять о себе, нетворкинг, доводить длинные сольные проекты без внешних дедлайнов.',
  open_3: 'Аналитический склад, довожу начатое до конца, спокоен в стрессе. Умею переводить сложное на понятный язык — коллеги приходят «объяснить по-человечески».',
  open_4: 'Через несколько лет — дата/продуктовый аналитик в устойчивой финтех-компании, стабильный доход, свой небольшой инструмент для личной аналитики, нормальный баланс.',
  open_5: 'Строил бы продукты, которые делают данные и личные финансы понятными обычным людям.',
};

const LEVEL: Record<string, number> = {
  analyticity: 0.86, conscientiousness: 0.78, self_control: 0.7, self_reliance: 0.72,
  emotional_stability: 0.6, vigilance: 0.58, openness: 0.66, dominance: 0.5, diplomacy: 0.56,
  sensitivity: 0.42, sociability: 0.38, social_boldness: 0.46, expressiveness: 0.34,
  abstractedness: 0.48, apprehension: 0.56, tension: 0.5,
  professional: 0.82, master: 0.64, instrumental: 0.56, patriotic: 0.34, lumpen: 0.14,
  autonomy: 0.8, mastery: 0.84, purpose: 0.72,
  R: 0.28, I: 0.9, A: 0.34, S: 0.32, E: 0.62, C: 0.72,
};
const lvl = (k: string) => LEVEL[k] ?? 0.5;
const distribute = (n: number, target: number, lo: number, hi: number) => {
  const base = Math.floor(target), extra = Math.round((target - base) * n);
  return Array.from({ length: n }, (_, i) => Math.min(hi, Math.max(lo, i < extra ? base + 1 : base)));
};

// closedAnswers: ключ = `${block}:${scaleKey}:${orderIndex}` (как questionId на сервере)
const groups = new Map<string, (typeof SEED_QUESTIONS)[number][]>();
for (const q of SEED_QUESTIONS) {
  const k = `${q.block}|${q.scaleKey}`;
  (groups.get(k) ?? groups.set(k, []).get(k)!).push(q);
}
const vals = new Map<string, number[]>();
for (const [k, qs] of groups) {
  const isR = qs[0]!.scaleType === 'RIASEC_4';
  const t = isR ? 1 + 3 * lvl(qs[0]!.scaleKey) : 1 + 4 * lvl(qs[0]!.scaleKey);
  vals.set(k, distribute(qs.length, t, 1, isR ? 4 : 5));
}
const cur = new Map<string, number>();
const closedAnswers: Record<string, number> = {};
for (const q of SEED_QUESTIONS) {
  const k = `${q.block}|${q.scaleKey}`;
  const i = cur.get(k) ?? 0; cur.set(k, i + 1);
  const v = vals.get(k)![i]!;
  const raw = q.scaleType === 'RIASEC_4' ? v : q.isReverse ? 6 - v : v;
  closedAnswers[`${q.block}:${q.scaleKey}:${q.orderIndex}`] = raw;
}

console.log(`POST ${TARGET}/api/report  (закрытых ответов: ${Object.keys(closedAnswers).length})`);
const t0 = Date.now();
const res = await fetch(`${TARGET}/api/report`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ profile, openAnswers, closedAnswers }),
});
const ms = Date.now() - t0;
if (!res.ok) {
  console.error(`✗ HTTP ${res.status} за ${ms}мс:`, (await res.text()).slice(0, 500));
  process.exit(1);
}
const data = (await res.json()) as { slug: string; report: any; professions: Record<string, unknown> };
console.log(`✓ HTTP 200 за ${(ms / 1000).toFixed(1)}с · slug=${data.slug}`);
console.log(`  ссылка на отчёт: ${TARGET}/report/${data.slug}`);
const r = data.report;
const checks: [string, boolean][] = [
  ['16 факторов', r.personality_traits?.length === 16],
  ['6 RIASEC', r.career?.riasec_profile?.length === 6],
  ['5 мотивации', r.motivation?.breakdown?.length === 5],
  ['4 недели', r.next_steps?.weekly_plan?.length === 4],
  ['≥4 профессий', r.career?.suitable_professions?.length >= 4],
  ['holland код', typeof r.career?.holland_code === 'string' && r.career.holland_code.length === 3],
  ['профессии в справочнике', Object.keys(data.professions ?? {}).length > 0],
];
console.log('Проверка отчёта:');
for (const [n, ok] of checks) console.log(`  ${ok ? '✓' : '✗'} ${n}`);
process.exit(checks.some(([, ok]) => !ok) ? 1 : 0);

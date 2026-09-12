import { SEED_QUESTIONS, OPEN_QUESTIONS, ANKETA_FIELDS } from '@profai/shared';
import type { SeedQuestion } from '@profai/shared';

/** Стабильный id закрытого вопроса. */
export const questionId = (q: SeedQuestion) => `${q.block}:${q.scaleKey}:${q.orderIndex}`;

export interface TestState {
  sessionId: string;
  consentAt?: string;
  profile: Record<string, string>; // ответы анкеты по field.key
  openAnswers: Record<string, string>; // open_1.. -> текст
  closedAnswers: Record<string, number>; // questionId -> 1..5 / 1..4
  stepIndex: number; // индекс в плоском массиве STEPS
  updatedAt: string;
}

// ─────────────── Плоский поток: один вопрос на экран ───────────────
// Разделы «Интро/Согласие/Анкета» — цельные экраны. Начиная с интервью
// каждый вопрос (открытый и закрытый) — отдельный шаг.

export type Step =
  | { kind: 'intro' }
  | { kind: 'consent' }
  | { kind: 'anketa' }
  | { kind: 'open'; question: { key: string; text: string }; section: string; idx: number; total: number }
  | { kind: 'closed'; question: SeedQuestion; section: string; idx: number; total: number }
  | { kind: 'waiting' };

// Разделы закрытых вопросов в порядке следования (данные не меняем).
const CLOSED_SECTIONS: { block: SeedQuestion['block']; label: string }[] = [
  { block: 'RIASEC', label: 'Интересы' },
  { block: 'PERSONALITY_16', label: 'Черты характера' },
  { block: 'GERCHIKOV', label: 'Мотивация' },
  { block: 'PINK', label: 'Драйверы' },
];

function buildSteps(): Step[] {
  const steps: Step[] = [{ kind: 'intro' }, { kind: 'consent' }, { kind: 'anketa' }];

  // Открытые вопросы интервью — по одному на экран.
  OPEN_QUESTIONS.forEach((question, i) =>
    steps.push({
      kind: 'open',
      question,
      section: 'Открытые вопросы',
      idx: i + 1,
      total: OPEN_QUESTIONS.length,
    }),
  );

  // Закрытые вопросы — по разделам, каждый вопрос отдельным шагом.
  for (const { block, label } of CLOSED_SECTIONS) {
    const qs = SEED_QUESTIONS.filter((q) => q.block === block);
    qs.forEach((question, i) =>
      steps.push({ kind: 'closed', question, section: label, idx: i + 1, total: qs.length }),
    );
  }

  steps.push({ kind: 'waiting' });
  return steps;
}

export const STEPS: Step[] = buildSteps();

// ─────────────── Прогресс (~136 точек ввода) ───────────────
const requiredAnketa = ANKETA_FIELDS.filter((f) => f.required);
export const TOTAL_INPUTS = requiredAnketa.length + OPEN_QUESTIONS.length + SEED_QUESTIONS.length;

export function answeredCount(s: TestState): number {
  const anketa = requiredAnketa.filter((f) => (s.profile[f.key] ?? '').trim() !== '').length;
  const open = OPEN_QUESTIONS.filter((q) => (s.openAnswers[q.key] ?? '').trim() !== '').length;
  const closed = Object.keys(s.closedAnswers).length;
  return anketa + open + closed;
}

export const anketaRequiredFilled = (s: TestState): boolean =>
  requiredAnketa.every((f) => (s.profile[f.key] ?? '').trim() !== '');

// ─────────────── Персистентность (автосейв) ───────────────
const KEY = 'profai.session.v2';

export function newState(): TestState {
  return {
    sessionId: crypto.randomUUID(),
    profile: {},
    openAnswers: {},
    closedAnswers: {},
    stepIndex: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function loadState(): TestState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as TestState;
    // защита от рассинхрона индекса при обновлении структуры шагов
    if (typeof s.stepIndex !== 'number' || s.stepIndex >= STEPS.length) s.stepIndex = 0;
    return s;
  } catch {
    return null;
  }
}

export function saveState(s: TestState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, updatedAt: new Date().toISOString() }));
  } catch {
    /* приватный режим / переполнение — молча игнорируем */
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Детерминированные формулы скоринга (scoring_formula.md).
 * Чистые функции, без БД и LLM. Все проценты в диапазоне 0-100.
 */

/** Округление до 1 знака после запятой (стабильно для хранения/сравнения). */
export const round1 = (x: number): number => Math.round(x * 10) / 10;

export interface RawAnswer {
  isReverse: boolean;
  rawValue: number;
}

/**
 * Likert (1-5) для 16 факторов, Герчикова и Пинка.
 * Реверс: adjusted = 6 - raw. percent = (sum - N) / (4N) * 100.
 */
export function scoreLikert(answers: RawAnswer[]): number {
  const n = answers.length;
  if (n === 0) throw new Error('scoreLikert: пустой набор ответов');
  const sum = answers.reduce(
    (acc, a) => acc + (a.isReverse ? 6 - a.rawValue : a.rawValue),
    0,
  );
  return round1(((sum - n) / (4 * n)) * 100);
}

/**
 * RIASEC (1-4), без реверса. Абсолютный процент по типу.
 * percent = (sum - N) / (3N) * 100 (диапазон суммы N..4N).
 */
export function scoreRiasecAbsolute(rawValues: number[]): number {
  const n = rawValues.length;
  if (n === 0) throw new Error('scoreRiasecAbsolute: пустой набор ответов');
  const sum = rawValues.reduce((acc, v) => acc + v, 0);
  return round1(((sum - n) / (3 * n)) * 100);
}

/**
 * Относительный вектор RIASEC: доли, в сумме дающие 100%
 * (для отображения профиля, как в референсном отчёте).
 */
export function riasecRelativeVector(
  absoluteByType: Record<string, number>,
): Record<string, number> {
  const total = Object.values(absoluteByType).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (const [key, abs] of Object.entries(absoluteByType)) {
    // если все абсолютные = 0 (все ответы «1»), делим поровну
    out[key] = total === 0 ? round1(100 / Object.keys(absoluteByType).length) : round1((abs / total) * 100);
  }
  return out;
}

/**
 * Трёхбуквенный код Холланда: топ-3 типа по относительному проценту.
 * При равенстве — стабильный порядок по исходному ключу (детерминированно).
 */
export function hollandCode(relativeByType: Record<string, number>): string {
  return Object.entries(relativeByType)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([key]) => key)
    .join('');
}

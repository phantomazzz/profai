/**
 * Оркестратор скоринга: принимает закрытые ответы (с метаданными вопроса)
 * и выдаёт ~30 итоговых значений + код Холланда + топ-факторы личности.
 * Результат ложится в computed_scores и уходит в финальный промпт LLM.
 */
import {
  scoreLikert,
  scoreRiasecAbsolute,
  riasecRelativeVector,
  hollandCode,
  type RawAnswer,
} from './formulas.js';

export type ScoringBlock = 'RIASEC' | 'PERSONALITY_16' | 'GERCHIKOV' | 'PINK';
export type ScaleCategory = 'RIASEC' | 'PERSONALITY' | 'GERCHIKOV' | 'PINK';

export interface AnsweredQuestion {
  block: ScoringBlock;
  scaleKey: string;
  isReverse: boolean;
  rawValue: number;
}

export interface ScoreResult {
  category: ScaleCategory;
  scaleKey: string;
  /** для RIASEC — относительный процент (вектор в 100%); иначе абсолютный */
  percent: number;
  /** только RIASEC: абсолютный процент до нормализации */
  percentAbsolute?: number;
}

export interface ScoringOutput {
  scores: ScoreResult[];
  hollandCode: string;
  /** топ-5 факторов личности по проценту (для фильтра профессий) */
  topFactorKeys: string[];
}

const BLOCK_TO_CATEGORY: Record<ScoringBlock, ScaleCategory> = {
  RIASEC: 'RIASEC',
  PERSONALITY_16: 'PERSONALITY',
  GERCHIKOV: 'GERCHIKOV',
  PINK: 'PINK',
};

/** Группировка ответов по scaleKey внутри блока. */
function groupByScale(
  answers: AnsweredQuestion[],
  block: ScoringBlock,
): Map<string, AnsweredQuestion[]> {
  const map = new Map<string, AnsweredQuestion[]>();
  for (const a of answers) {
    if (a.block !== block) continue;
    const arr = map.get(a.scaleKey) ?? [];
    arr.push(a);
    map.set(a.scaleKey, arr);
  }
  return map;
}

const toRaw = (a: AnsweredQuestion): RawAnswer => ({
  isReverse: a.isReverse,
  rawValue: a.rawValue,
});

export function computeScores(answers: AnsweredQuestion[]): ScoringOutput {
  const scores: ScoreResult[] = [];

  // Likert-блоки: 16 факторов, Герчиков, Пинк
  for (const block of ['PERSONALITY_16', 'GERCHIKOV', 'PINK'] as const) {
    for (const [scaleKey, group] of groupByScale(answers, block)) {
      scores.push({
        category: BLOCK_TO_CATEGORY[block],
        scaleKey,
        percent: scoreLikert(group.map(toRaw)),
      });
    }
  }

  // RIASEC: сначала абсолютные, затем относительный вектор
  const riasecGroups = groupByScale(answers, 'RIASEC');
  const absoluteByType: Record<string, number> = {};
  for (const [scaleKey, group] of riasecGroups) {
    absoluteByType[scaleKey] = scoreRiasecAbsolute(group.map((a) => a.rawValue));
  }
  const relative = riasecRelativeVector(absoluteByType);
  for (const scaleKey of Object.keys(absoluteByType)) {
    scores.push({
      category: 'RIASEC',
      scaleKey,
      percent: relative[scaleKey]!,
      percentAbsolute: absoluteByType[scaleKey]!,
    });
  }

  const code = hollandCode(relative);

  const topFactorKeys = scores
    .filter((s) => s.category === 'PERSONALITY')
    .sort((a, b) => b.percent - a.percent || a.scaleKey.localeCompare(b.scaleKey))
    .slice(0, 5)
    .map((s) => s.scaleKey);

  return { scores, hollandCode: code, topFactorKeys };
}

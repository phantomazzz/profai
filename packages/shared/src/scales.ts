/**
 * Единый источник правды по шкалам теста.
 * Ключи (латиница) используются в коде и БД (computed_scores.scaleKey),
 * label — человекочитаемое имя (RU),
 * traitTagAliases — как этот фактор назван в professions.trait_tags
 *   (там встречаются сокращения «Соц. смелость», «Эмоц. устойчивость»),
 *   нужно для детерминированной фильтрации профессий.
 */

export type QuestionBlock =
  | 'ANKETA'
  | 'OPEN'
  | 'RIASEC'
  | 'PERSONALITY_16'
  | 'GERCHIKOV'
  | 'PINK';

export type ScaleType = 'LIKERT_5' | 'RIASEC_4';

export interface ScaleDef {
  key: string;
  label: string;
  /** Кол-во вопросов в блоке (N в формуле скоринга). */
  questionCount: number;
  /** Синонимы в professions.trait_tags / motivation_tags (для матчинга). */
  aliases?: string[];
}

/** RIASEC / Холланд — 6 типов интересов, шкала 1-4, без реверса, N=5. */
export const RIASEC_TYPES: ScaleDef[] = [
  { key: 'R', label: 'Реалистический', questionCount: 5 },
  { key: 'I', label: 'Исследовательский', questionCount: 5 },
  { key: 'A', label: 'Артистический', questionCount: 5 },
  { key: 'S', label: 'Социальный', questionCount: 5 },
  { key: 'E', label: 'Предпринимательский', questionCount: 5 },
  { key: 'C', label: 'Конвенциональный', questionCount: 5 },
];

/** 16 факторов личности, шкала 1-5, есть реверс. N=4 или 5. */
export const PERSONALITY_FACTORS: ScaleDef[] = [
  { key: 'sociability', label: 'Общительность', questionCount: 5, aliases: ['Общительность'] },
  { key: 'analyticity', label: 'Аналитичность', questionCount: 4, aliases: ['Аналитичность'] },
  { key: 'emotional_stability', label: 'Эмоциональная устойчивость', questionCount: 4, aliases: ['Эмоц. устойчивость', 'Эмоциональная устойчивость'] },
  { key: 'dominance', label: 'Доминантность', questionCount: 4, aliases: ['Доминантность'] },
  { key: 'expressiveness', label: 'Экспрессивность', questionCount: 4, aliases: ['Экспрессивность'] },
  { key: 'conscientiousness', label: 'Правильность', questionCount: 4, aliases: ['Правильность'] },
  { key: 'social_boldness', label: 'Социальная смелость', questionCount: 4, aliases: ['Соц. смелость', 'Социальная смелость'] },
  { key: 'sensitivity', label: 'Чувствительность', questionCount: 4, aliases: ['Чувствительность'] },
  { key: 'vigilance', label: 'Подозрительность', questionCount: 4, aliases: ['Подозрительность'] },
  { key: 'abstractedness', label: 'Мечтательность', questionCount: 4, aliases: ['Мечтательность'] },
  { key: 'diplomacy', label: 'Дипломатичность', questionCount: 4, aliases: ['Дипломатичность'] },
  { key: 'apprehension', label: 'Тревожность', questionCount: 4, aliases: ['Тревожность'] },
  { key: 'openness', label: 'Открытость к изменениям', questionCount: 4, aliases: ['Открытость к изменениям'] },
  { key: 'self_reliance', label: 'Независимость', questionCount: 4, aliases: ['Независимость'] },
  { key: 'self_control', label: 'Самоконтроль', questionCount: 4, aliases: ['Самоконтроль'] },
  { key: 'tension', label: 'Напряжённость', questionCount: 4, aliases: ['Напряжённость'] },
];

/** Мотивация по Герчикову, шкала 1-5, есть реверс, N=4. */
export const GERCHIKOV_TYPES: ScaleDef[] = [
  { key: 'professional', label: 'Профессиональный', questionCount: 4, aliases: ['Профессиональный'] },
  { key: 'instrumental', label: 'Инструментальный', questionCount: 4, aliases: ['Инструментальный'] },
  { key: 'master', label: 'Хозяйский', questionCount: 4, aliases: ['Хозяйский'] },
  { key: 'patriotic', label: 'Патриотический', questionCount: 4, aliases: ['Патриотический'] },
  { key: 'lumpen', label: 'Люмпенизированный', questionCount: 4, aliases: ['Люмпенизированный'] },
];

/** Мотиваторы Пинка, шкала 1-5, без реверса, N=3. */
export const PINK_TYPES: ScaleDef[] = [
  { key: 'autonomy', label: 'Автономия', questionCount: 3 },
  { key: 'mastery', label: 'Мастерство', questionCount: 3 },
  { key: 'purpose', label: 'Цель', questionCount: 3 },
];

/** Обратный индекс: alias из trait_tags → ключ фактора личности. */
export const TRAIT_TAG_TO_FACTOR: Record<string, string> = Object.fromEntries(
  PERSONALITY_FACTORS.flatMap((f) => (f.aliases ?? []).map((a) => [a, f.key])),
);

/** Обратный индекс: alias из motivation_tags → ключ типа Герчикова. */
export const MOTIVATION_TAG_TO_TYPE: Record<string, string> = Object.fromEntries(
  GERCHIKOV_TYPES.flatMap((t) => (t.aliases ?? []).map((a) => [a, t.key])),
);

export const SCALE_CATEGORY = {
  RIASEC: 'RIASEC',
  PERSONALITY: 'PERSONALITY',
  GERCHIKOV: 'GERCHIKOV',
  PINK: 'PINK',
} as const;

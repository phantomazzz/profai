import { describe, it, expect } from 'vitest';
import {
  RIASEC_TYPES,
  PERSONALITY_FACTORS,
  GERCHIKOV_TYPES,
  PINK_TYPES,
  SEED_QUESTIONS,
} from '@profai/shared';

/** Верификация транскрипции банка вопросов против конфига шкал. */
describe('банк вопросов (124 закрытых)', () => {
  it('всего 124 вопроса', () => {
    expect(SEED_QUESTIONS).toHaveLength(124);
  });

  const countByScale = (scaleKey: string) =>
    SEED_QUESTIONS.filter((q) => q.scaleKey === scaleKey).length;

  const suites = [
    { name: 'RIASEC', defs: RIASEC_TYPES },
    { name: 'PERSONALITY', defs: PERSONALITY_FACTORS },
    { name: 'GERCHIKOV', defs: GERCHIKOV_TYPES },
    { name: 'PINK', defs: PINK_TYPES },
  ];

  for (const { name, defs } of suites) {
    describe(name, () => {
      for (const def of defs) {
        it(`${def.key}: ${def.questionCount} вопросов`, () => {
          expect(countByScale(def.key)).toBe(def.questionCount);
        });
      }
    });
  }

  it('RIASEC без реверс-вопросов', () => {
    const riasec = SEED_QUESTIONS.filter((q) => q.block === 'RIASEC');
    expect(riasec.every((q) => !q.isReverse)).toBe(true);
    expect(riasec.every((q) => q.scaleType === 'RIASEC_4')).toBe(true);
  });

  it('Пинк без реверс-вопросов', () => {
    const pink = SEED_QUESTIONS.filter((q) => q.block === 'PINK');
    expect(pink.every((q) => !q.isReverse)).toBe(true);
  });

  it('16 факторов: ровно по одному реверс-вопросу на фактор', () => {
    for (const f of PERSONALITY_FACTORS) {
      const reverses = SEED_QUESTIONS.filter(
        (q) => q.scaleKey === f.key && q.isReverse,
      );
      expect(reverses).toHaveLength(1);
    }
  });

  it('Герчиков: ровно по одному реверс-вопросу на тип', () => {
    for (const t of GERCHIKOV_TYPES) {
      const reverses = SEED_QUESTIONS.filter(
        (q) => q.scaleKey === t.key && q.isReverse,
      );
      expect(reverses).toHaveLength(1);
    }
  });

  it('порядковые номера внутри каждой шкалы уникальны и последовательны', () => {
    const byScale = new Map<string, number[]>();
    for (const q of SEED_QUESTIONS) {
      const arr = byScale.get(q.scaleKey) ?? [];
      arr.push(q.orderIndex);
      byScale.set(q.scaleKey, arr);
    }
    for (const [, orders] of byScale) {
      const sorted = [...orders].sort((a, b) => a - b);
      expect(sorted).toEqual(orders.map((_, i) => i + 1));
    }
  });
});

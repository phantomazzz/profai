import { describe, it, expect } from 'vitest';
import {
  scoreLikert,
  scoreRiasecAbsolute,
  riasecRelativeVector,
  hollandCode,
} from '../scoring/formulas.js';
import { computeScores, type AnsweredQuestion } from '../scoring/index.js';
import { SEED_QUESTIONS } from '@profai/shared';

describe('формулы скоринга', () => {
  describe('scoreLikert', () => {
    it('контрольный пример из спеки: сумма 19 при N=5 → 70%', () => {
      // 4 обычных ответа «4» + 1 реверс с raw=3 (adjusted=3): сумма = 19
      const answers = [
        { rawValue: 4, isReverse: false },
        { rawValue: 4, isReverse: false },
        { rawValue: 4, isReverse: false },
        { rawValue: 4, isReverse: false },
        { rawValue: 3, isReverse: true },
      ];
      expect(scoreLikert(answers)).toBe(70);
    });

    it('все максимальные ответы (без реверса) → 100%', () => {
      expect(scoreLikert(Array(4).fill({ rawValue: 5, isReverse: false }))).toBe(100);
    });

    it('все минимальные ответы (без реверса) → 0%', () => {
      expect(scoreLikert(Array(4).fill({ rawValue: 1, isReverse: false }))).toBe(0);
    });

    it('реверс инвертирует: raw=1 у реверсивного даёт максимум', () => {
      expect(scoreLikert([{ rawValue: 1, isReverse: true }])).toBe(100);
    });
  });

  describe('scoreRiasecAbsolute (шкала 1-4)', () => {
    it('все «4» → 100%', () => {
      expect(scoreRiasecAbsolute([4, 4, 4, 4, 4])).toBe(100);
    });
    it('все «1» → 0%', () => {
      expect(scoreRiasecAbsolute([1, 1, 1, 1, 1])).toBe(0);
    });
    it('(sum-N)/(3N)*100: sum=15,N=5 → 66.7%', () => {
      expect(scoreRiasecAbsolute([3, 3, 3, 3, 3])).toBe(66.7);
    });
  });

  describe('относительный вектор RIASEC', () => {
    it('в сумме даёт ~100%', () => {
      const rel = riasecRelativeVector({ R: 10, I: 40, A: 20, S: 10, E: 15, C: 5 });
      const total = Object.values(rel).reduce((a, b) => a + b, 0);
      expect(Math.round(total)).toBe(100);
    });
    it('все нули → равномерно (не деление на ноль)', () => {
      const rel = riasecRelativeVector({ R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 });
      expect(Object.values(rel).every((v) => v > 0)).toBe(true);
    });
  });

  describe('hollandCode', () => {
    it('топ-3 типа по относительному проценту', () => {
      expect(hollandCode({ R: 5, I: 40, A: 20, S: 10, E: 15, C: 10 })).toBe('IAE');
    });
    it('детерминирован при равенстве (по ключу)', () => {
      expect(hollandCode({ R: 10, I: 10, A: 10, S: 5, E: 5, C: 5 })).toBe('AIR');
    });
  });
});

describe('computeScores — полный прогон 124 ответов', () => {
  // Собираем валидный набор ответов из банка вопросов.
  const build = (fn: (q: (typeof SEED_QUESTIONS)[number]) => number): AnsweredQuestion[] =>
    SEED_QUESTIONS.map((q) => ({
      block: q.block,
      scaleKey: q.scaleKey,
      isReverse: q.isReverse,
      rawValue: fn(q),
    }));

  it('выдаёт ровно 30 значений (16+6+5+3)', () => {
    const out = computeScores(build((q) => (q.scaleType === 'RIASEC_4' ? 3 : 3)));
    expect(out.scores).toHaveLength(30);
    const byCat = (c: string) => out.scores.filter((s) => s.category === c).length;
    expect(byCat('PERSONALITY')).toBe(16);
    expect(byCat('RIASEC')).toBe(6);
    expect(byCat('GERCHIKOV')).toBe(5);
    expect(byCat('PINK')).toBe(3);
  });

  it('код Холланда — 3 буквы, топ-факторы — 5 ключей', () => {
    const out = computeScores(build((q) => (q.scaleType === 'RIASEC_4' ? 3 : 4)));
    expect(out.hollandCode).toHaveLength(3);
    expect(out.topFactorKeys).toHaveLength(5);
  });

  it('все проценты в диапазоне 0-100', () => {
    const out = computeScores(build((q) => (q.scaleType === 'RIASEC_4' ? 2 : 3)));
    for (const s of out.scores) {
      expect(s.percent).toBeGreaterThanOrEqual(0);
      expect(s.percent).toBeLessThanOrEqual(100);
    }
  });

  it('RIASEC-значения несут и относительный, и абсолютный процент', () => {
    const out = computeScores(build((q) => (q.scaleType === 'RIASEC_4' ? 3 : 3)));
    const riasec = out.scores.filter((s) => s.category === 'RIASEC');
    expect(riasec.every((s) => typeof s.percentAbsolute === 'number')).toBe(true);
  });
});

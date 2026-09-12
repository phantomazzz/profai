import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { filterProfessions, type ProfessionLike } from '../professions/filter.js';

const raw = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../prisma/seed-data/professions.json', import.meta.url)),
    'utf-8',
  ),
) as { professions: { id: string; riasec_code: string; trait_tags: string[] }[] };

const professions: ProfessionLike[] = raw.professions.map((p) => ({
  id: p.id,
  riasecCode: p.riasec_code,
  traitTags: p.trait_tags,
}));

describe('filterProfessions на стартовой базе (16 профессий)', () => {
  it('«аналитический» пользователь (IEC) получает дата-аналитика в подходящих', () => {
    // дата-аналитик: riasec IEC, trait_tags Аналитичность/Правильность/Самоконтроль
    const out = filterProfessions(professions, 'IEC', [
      'analyticity',
      'conscientiousness',
      'self_control',
      'dominance',
      'vigilance',
    ]);
    const suitableIds = out.suitable.map((s) => s.professionId);
    expect(suitableIds).toContain('profession-data-analyst');
    // топовый кандидат — с максимальным совпадением букв и trait
    expect(out.suitable[0]!.letterMatch).toBeGreaterThanOrEqual(2);
  });

  it('возвращает 5 подходящих и до 3 неподходящих', () => {
    const out = filterProfessions(professions, 'IEC', [
      'analyticity',
      'conscientiousness',
      'self_control',
      'dominance',
      'vigilance',
    ]);
    expect(out.suitable).toHaveLength(5);
    expect(out.unsuitable.length).toBeGreaterThanOrEqual(2);
    expect(out.unsuitable.length).toBeLessThanOrEqual(3);
  });

  it('подходящие и неподходящие не пересекаются', () => {
    const out = filterProfessions(professions, 'SAI', [
      'sensitivity',
      'diplomacy',
      'sociability',
      'expressiveness',
      'emotional_stability',
    ]);
    const s = new Set(out.suitable.map((x) => x.professionId));
    expect(out.unsuitable.every((x) => !s.has(x.professionId))).toBe(true);
  });

  it('неподходящие — «осмысленно не то»: совпадение букв не нулевое', () => {
    const out = filterProfessions(professions, 'SAI', [
      'sensitivity',
      'diplomacy',
      'sociability',
      'expressiveness',
      'emotional_stability',
    ]);
    expect(out.unsuitable.every((x) => x.letterMatch >= 1)).toBe(true);
  });

  it('подходящие отсортированы по убыванию пригодности', () => {
    const out = filterProfessions(professions, 'IEC', [
      'analyticity',
      'conscientiousness',
      'self_control',
      'dominance',
      'vigilance',
    ]);
    for (let i = 1; i < out.suitable.length; i++) {
      const prev = out.suitable[i - 1]!;
      const cur = out.suitable[i]!;
      const prevScore = prev.traitOverlap * 10 + prev.letterMatch;
      const curScore = cur.traitOverlap * 10 + cur.letterMatch;
      expect(prevScore).toBeGreaterThanOrEqual(curScore);
    }
  });

  it('фоллбэк: редкий профиль всё равно даёт 5 подходящих', () => {
    // «RAC» — реалистический профиль, кандидатов с >=2 буквами мало
    const out = filterProfessions(professions, 'RAC', [
      'self_reliance',
      'emotional_stability',
      'conscientiousness',
      'analyticity',
      'self_control',
    ]);
    expect(out.suitable).toHaveLength(5);
  });
});

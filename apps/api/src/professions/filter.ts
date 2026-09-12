/**
 * Детерминированный подбор шорт-листа профессий перед финальным LLM-вызовом
 * (scoring_formula.md §5). LLM получает не всю базу, а 5 «подходящих» и
 * 2-3 «осмысленно неподходящих» — с уже посчитанным обоснованием совпадения.
 */
import { TRAIT_TAG_TO_FACTOR } from '@profai/shared';

export interface ProfessionLike {
  id: string;
  riasecCode: string; // напр. "IEC"
  traitTags: string[]; // рус. названия, матчатся через TRAIT_TAG_TO_FACTOR
}

export interface ScoredProfession {
  professionId: string;
  /** совпавших букв RIASEC с топ-3 пользователя (0-3) */
  letterMatch: number;
  /** пересечение trait_tags с топ-факторами пользователя */
  traitOverlap: number;
}

export interface ProfessionShortlist {
  suitable: ScoredProfession[];
  unsuitable: ScoredProfession[];
}

export interface FilterOptions {
  suitableCount?: number; // по умолчанию 5
  unsuitableCount?: number; // по умолчанию 3
}

function scoreProfession(
  p: ProfessionLike,
  userLetters: Set<string>,
  userFactorKeys: Set<string>,
): ScoredProfession {
  const letters = p.riasecCode.toUpperCase().split('');
  const letterMatch = letters.filter((l) => userLetters.has(l)).length;

  const mappedFactors = new Set(
    p.traitTags
      .map((tag) => TRAIT_TAG_TO_FACTOR[tag])
      .filter((k): k is string => Boolean(k)),
  );
  let traitOverlap = 0;
  for (const f of mappedFactors) if (userFactorKeys.has(f)) traitOverlap++;

  return { professionId: p.id, letterMatch, traitOverlap };
}

/** Сортировка кандидатов: сильнее совпадение trait, затем букв, затем стабильно по id. */
const byFitDesc = (a: ScoredProfession, b: ScoredProfession) =>
  b.traitOverlap - a.traitOverlap ||
  b.letterMatch - a.letterMatch ||
  a.professionId.localeCompare(b.professionId);

export function filterProfessions(
  professions: ProfessionLike[],
  hollandTop3: string, // код Холланда, напр. "IEC"
  topFactorKeys: string[],
  options: FilterOptions = {},
): ProfessionShortlist {
  const suitableCount = options.suitableCount ?? 5;
  const unsuitableCount = options.unsuitableCount ?? 3;

  const userLetters = new Set(hollandTop3.toUpperCase().split(''));
  const userFactorKeys = new Set(topFactorKeys);

  const scored = professions.map((p) =>
    scoreProfession(p, userLetters, userFactorKeys),
  );

  // Кандидаты: совпадение >= 2 букв RIASEC.
  let candidates = scored.filter((s) => s.letterMatch >= 2).sort(byFitDesc);

  // Фоллбэк: если кандидатов не хватает на подходящие, добираем с 1 буквой.
  if (candidates.length < suitableCount) {
    const relaxed = scored
      .filter((s) => s.letterMatch === 1 && !candidates.includes(s))
      .sort(byFitDesc);
    candidates = [...candidates, ...relaxed];
  }

  const suitable = candidates.slice(0, suitableCount);

  // Неподходящие: наименьшее совпадение, но не нулевое (осмысленно «не то»),
  // и не попавшие в подходящие. Сначала из хвоста кандидатов, при нехватке —
  // из остальных с letterMatch >= 1.
  const chosen = new Set(suitable.map((s) => s.professionId));
  const nonZero = scored
    .filter((s) => s.letterMatch >= 1 && !chosen.has(s.professionId))
    .sort((a, b) => byFitDesc(b, a)); // возрастание пригодности → худшие первыми

  const unsuitable = nonZero.slice(0, unsuitableCount);

  return { suitable, unsuitable };
}

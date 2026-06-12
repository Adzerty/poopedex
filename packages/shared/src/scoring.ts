/**
 * Règles de notation Poopedex — source de vérité unique (API + futur natif).
 *
 * 4 axes notés sur 5 :
 *  - cleanliness  : étoiles 1..5 (subjectif)
 *  - safety       : étoiles 1..5 (subjectif)
 *  - hygiene      : dérivé de flags factuels (savon / papier / poubelle)
 *  - inclusivity  : dérivé de flags factuels (protections hygiéniques / table à langer)
 *
 * Les flags → score = (proportion de flags vrais) * 5.
 * `overall` = moyenne pondérée des 4 axes.
 *
 * Les pondérations sont ajustables ici SANS migration de base.
 */

export interface HygieneFlags {
  hasSoap: boolean;
  hasToiletPaper: boolean;
  hasBin: boolean;
}

export interface InclusivityFlags {
  hasMenstrualProducts: boolean;
  hasBabyChanging: boolean;
}

export interface RatingInput {
  cleanliness: number; // 1..5
  safety: number; // 1..5
  hygiene: HygieneFlags;
  inclusivity: InclusivityFlags;
}

export interface ComputedScores {
  hygieneScore: number; // 0..5
  inclusivityScore: number; // 0..5
  overallScore: number; // 0..5
}

/** Pondération de l'axe dans la note globale. Doit sommer à 1. */
export const AXIS_WEIGHTS = {
  cleanliness: 0.3,
  hygiene: 0.3,
  safety: 0.25,
  inclusivity: 0.15,
} as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Proportion de flags vrais, ramenée sur une échelle 0..5. */
function flagsToScore(flags: boolean[]): number {
  if (flags.length === 0) return 0;
  const trueCount = flags.filter(Boolean).length;
  return (trueCount / flags.length) * 5;
}

/**
 * Score de rareté gagné en check-in : décroît avec la popularité de la toilette.
 * `poopsCountBefore` est le nombre de poops déjà enregistrés au moment du check-in.
 * Première personne sur la toilette : RARITY_MAX_POINTS, puis 50, 33, 25…
 * Plancher à 1 pour qu'un check-in rapporte toujours au moins 1 point.
 */
export const RARITY_MAX_POINTS = 100;

export function computeRarityScore(poopsCountBefore: number): number {
  const raw = RARITY_MAX_POINTS / (1 + Math.max(0, poopsCountBefore));
  return Math.max(1, Math.round(raw));
}

export function computeScores(input: RatingInput): ComputedScores {
  const hygieneScore = flagsToScore([
    input.hygiene.hasSoap,
    input.hygiene.hasToiletPaper,
    input.hygiene.hasBin,
  ]);

  const inclusivityScore = flagsToScore([
    input.inclusivity.hasMenstrualProducts,
    input.inclusivity.hasBabyChanging,
  ]);

  const overallScore =
    input.cleanliness * AXIS_WEIGHTS.cleanliness +
    input.safety * AXIS_WEIGHTS.safety +
    hygieneScore * AXIS_WEIGHTS.hygiene +
    inclusivityScore * AXIS_WEIGHTS.inclusivity;

  return {
    hygieneScore: round2(hygieneScore),
    inclusivityScore: round2(inclusivityScore),
    overallScore: round2(overallScore),
  };
}

import type { Db } from '../../db/pool';

/** Stats agrégées d'un user, base de l'évaluation des badges. */
interface UserStats {
  totalPoops: number;
  distinctToilets: number;
  totalRatings: number;
  totalPoints: number;
  maxRarityScore: number;
}

/** Critère déclaratif stocké dans badges.criteria (JSONB). */
type Criteria =
  | { type: 'total_poops'; gte: number }
  | { type: 'distinct_toilets'; gte: number }
  | { type: 'total_ratings'; gte: number }
  | { type: 'total_points'; gte: number }
  | { type: 'single_poop_score'; gte: number };

function isMet(criteria: Criteria, stats: UserStats): boolean {
  switch (criteria.type) {
    case 'total_poops':
      return stats.totalPoops >= criteria.gte;
    case 'distinct_toilets':
      return stats.distinctToilets >= criteria.gte;
    case 'total_ratings':
      return stats.totalRatings >= criteria.gte;
    case 'total_points':
      return stats.totalPoints >= criteria.gte;
    case 'single_poop_score':
      return stats.maxRarityScore >= criteria.gte;
    default:
      return false;
  }
}

export async function getUserStats(client: Db, userId: string): Promise<UserStats> {
  const { rows } = await client.query(
    `SELECT
       (SELECT count(*) FROM poops WHERE user_id = $1)                       AS total_poops,
       (SELECT count(DISTINCT toilet_id) FROM poops WHERE user_id = $1)      AS distinct_toilets,
       (SELECT count(*) FROM ratings r
          JOIN poops p ON p.id = r.poop_id WHERE p.user_id = $1)             AS total_ratings,
       (SELECT coalesce(sum(rarity_score), 0) FROM poops WHERE user_id = $1) AS total_points,
       (SELECT coalesce(max(rarity_score), 0) FROM poops WHERE user_id = $1) AS max_rarity_score`,
    [userId],
  );
  const row = rows[0];
  return {
    totalPoops: Number(row.total_poops),
    distinctToilets: Number(row.distinct_toilets),
    totalRatings: Number(row.total_ratings),
    totalPoints: Number(row.total_points),
    maxRarityScore: Number(row.max_rarity_score),
  };
}

/**
 * Évalue et débloque les badges nouvellement atteints. Idempotent grâce au
 * ON CONFLICT DO NOTHING. Retourne les badges fraîchement débloqués.
 */
export async function evaluateBadges(
  client: Db,
  userId: string,
  stats: UserStats,
): Promise<{ code: string; name: string }[]> {
  const { rows: badges } = await client.query<{ id: string; code: string; name: string; criteria: Criteria }>(
    'SELECT id, code, name, criteria FROM badges',
  );

  const newlyUnlocked: { code: string; name: string }[] = [];
  for (const badge of badges) {
    if (!isMet(badge.criteria, stats)) continue;
    const res = await client.query(
      'INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, badge.id],
    );
    if (res.rowCount) newlyUnlocked.push({ code: badge.code, name: badge.name });
  }
  return newlyUnlocked;
}

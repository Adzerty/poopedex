import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { pool } from '../../db/pool';
import { NotFound, Unauthorized } from '../../lib/errors';
import { getUserStats } from '../badges/service';

type FriendshipStatus = 'none' | 'self' | 'pending_outgoing' | 'pending_incoming' | 'accepted';

/**
 * Calcule la relation d'amitié entre `viewerId` (l'utilisateur authentifié)
 * et `targetId`. `null` si pas authentifié.
 */
async function getFriendshipStatus(
  viewerId: string | null,
  targetId: string,
): Promise<FriendshipStatus | null> {
  if (!viewerId) return null;
  if (viewerId === targetId) return 'self';
  const { rows } = await pool.query<{ requester_id: string; status: string }>(
    `SELECT requester_id, status
     FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)`,
    [viewerId, targetId],
  );
  const row = rows[0];
  if (!row) return 'none';
  if (row.status === 'accepted') return 'accepted';
  if (row.status === 'pending') {
    return row.requester_id === viewerId ? 'pending_outgoing' : 'pending_incoming';
  }
  return 'none';
}

async function loadProfile(userId: string, viewerId: string | null) {
  const { rows } = await pool.query<{
    id: string;
    username: string;
    avatar_url: string | null;
    created_at: Date;
    is_admin: boolean;
  }>(
    'SELECT id, username, avatar_url, created_at, is_admin FROM users WHERE id = $1',
    [userId],
  );
  const user = rows[0];
  if (!user) throw NotFound('Utilisateur introuvable');

  const stats = await getUserStats(pool, userId);

  const { rows: badges } = await pool.query(
    `SELECT b.code, b.name, b.description, b.icon, ub.unlocked_at
     FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
     WHERE ub.user_id = $1 ORDER BY ub.unlocked_at DESC`,
    [userId],
  );

  const friendshipStatus = await getFriendshipStatus(viewerId, userId);

  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatar_url,
    memberSince: user.created_at,
    isAdmin: user.is_admin,
    stats,
    badges,
    friendshipStatus,
  };
}

const LeaderboardQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  scope: z.enum(['global', 'friends']).default('global'),
});

const LeaderboardEntry = z.object({
  id: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  totalPoints: z.number(),
  totalPoops: z.number(),
  distinctToilets: z.number(),
});

const userRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Mon profil (privé).
  r.get('/me', { preHandler: app.authenticate }, async (req) => loadProfile(req.user.sub, req.user.sub));

  // Classement public des plus gros chieurs (par score de rareté cumulé).
  // - scope=global → tout le monde (anonyme OK)
  // - scope=friends → moi + amis acceptés (auth requise)
  // Tri : total_points ↓, total_poops ↓, ancienneté ↑ (départage stable).
  // On ne liste que les users qui ont au moins un poop.
  // Doit être déclarée avant `/:id` pour ne pas se faire matcher comme un UUID.
  r.get(
    '/leaderboard',
    {
      preHandler: app.optionalAuth,
      schema: { querystring: LeaderboardQuery, response: { 200: z.array(LeaderboardEntry) } },
    },
    async (req) => {
      const { limit, scope } = req.query;

      if (scope === 'friends') {
        if (!req.user) throw Unauthorized('Auth requise pour le classement entre amis');
        const me = req.user.sub;
        const { rows } = await pool.query(
          `SELECT u.id, u.username, u.avatar_url, u.created_at,
                  COALESCE(SUM(p.rarity_score), 0) AS total_points,
                  COUNT(p.id)                      AS total_poops,
                  COUNT(DISTINCT p.toilet_id)      AS distinct_toilets
           FROM users u
           JOIN poops p ON p.user_id = u.id
           WHERE u.id = $1
              OR u.id IN (
                SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END
                FROM friendships
                WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)
              )
           GROUP BY u.id
           ORDER BY total_points DESC, total_poops DESC, u.created_at ASC, u.id
           LIMIT $2`,
          [me, limit],
        );
        return rows.map((row) => ({
          id: row.id,
          username: row.username,
          avatarUrl: row.avatar_url,
          totalPoints: Number(row.total_points),
          totalPoops: Number(row.total_poops),
          distinctToilets: Number(row.distinct_toilets),
        }));
      }

      const { rows } = await pool.query(
        `SELECT u.id,
                u.username,
                u.avatar_url,
                u.created_at,
                COALESCE(SUM(p.rarity_score), 0)       AS total_points,
                COUNT(p.id)                            AS total_poops,
                COUNT(DISTINCT p.toilet_id)            AS distinct_toilets
         FROM users u
         JOIN poops p ON p.user_id = u.id
         GROUP BY u.id
         ORDER BY total_points DESC,
                  total_poops DESC,
                  u.created_at ASC,
                  u.id
         LIMIT $1`,
        [limit],
      );

      return rows.map((row) => ({
        id: row.id,
        username: row.username,
        avatarUrl: row.avatar_url,
        totalPoints: Number(row.total_points),
        totalPoops: Number(row.total_poops),
        distinctToilets: Number(row.distinct_toilets),
      }));
    },
  );

  // Profil public d'un autre user (sans email). On lit l'auth si présent pour
  // pouvoir renvoyer le statut d'amitié vu par l'appelant.
  r.get(
    '/:id',
    {
      preHandler: app.optionalAuth,
      schema: { params: z.object({ id: z.string().uuid() }) },
    },
    async (req) => loadProfile(req.params.id, req.user?.sub ?? null),
  );
};

export default userRoutes;

import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { pool } from '../../db/pool';
import { NotFound } from '../../lib/errors';
import { getUserStats } from '../badges/service';

async function loadProfile(userId: string) {
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

  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatar_url,
    memberSince: user.created_at,
    isAdmin: user.is_admin,
    stats,
    badges,
  };
}

const userRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Mon profil (privé).
  r.get('/me', { preHandler: app.authenticate }, async (req) => loadProfile(req.user.sub));

  // Profil public d'un autre user (sans email).
  r.get(
    '/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req) => loadProfile(req.params.id),
  );
};

export default userRoutes;

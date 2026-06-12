import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { pool } from '../../db/pool';
import { NotFound } from '../../lib/errors';

const adminRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Liste de TOUTES les toilettes (incl. soft-deleted) — vue de modération.
  r.get(
    '/toilets',
    { preHandler: app.requireAdmin },
    async () => {
      const { rows } = await pool.query(
        `SELECT t.id,
                t.name,
                t.source,
                t.status,
                t.is_deleted,
                ST_Y(t.location::geometry) AS lat,
                ST_X(t.location::geometry) AS lng,
                t.poops_count,
                t.ratings_count,
                t.avg_overall,
                t.created_at,
                t.deleted_at,
                u.username AS created_by_username
         FROM toilets t
         LEFT JOIN users u ON u.id = t.created_by
         ORDER BY t.created_at DESC
         LIMIT 1000`,
      );
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        source: row.source,
        status: row.status,
        isDeleted: row.is_deleted,
        lat: row.lat,
        lng: row.lng,
        poopsCount: Number(row.poops_count),
        ratingsCount: Number(row.ratings_count),
        avgOverall: row.avg_overall === null ? null : Number(row.avg_overall),
        createdAt: row.created_at,
        deletedAt: row.deleted_at,
        createdByUsername: row.created_by_username,
      }));
    },
  );

  // Liste de TOUS les users — vue de modération (sans password_hash bien sûr).
  r.get(
    '/users',
    { preHandler: app.requireAdmin },
    async () => {
      const { rows } = await pool.query(
        `SELECT u.id, u.username, u.email, u.is_admin, u.avatar_url, u.created_at,
                (SELECT count(*) FROM poops p WHERE p.user_id = u.id)::int AS poops_count
         FROM users u
         ORDER BY u.created_at DESC
         LIMIT 1000`,
      );
      return rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        isAdmin: row.is_admin,
        avatarUrl: row.avatar_url,
        createdAt: row.created_at,
        poopsCount: Number(row.poops_count),
      }));
    },
  );

  // Soft-delete d'une toilette. L'OSM ingest respecte ce flag : elle ne sera pas
  // ressuscitée au prochain refetch Overpass (cf. ingest/service.ts).
  r.delete(
    '/toilets/:id',
    {
      preHandler: app.requireAdmin,
      schema: { params: z.object({ id: z.string().uuid() }) },
    },
    async (req, reply) => {
      const adminId = req.user.sub;
      const { rowCount } = await pool.query(
        `UPDATE toilets
         SET is_deleted = true,
             deleted_at = now(),
             deleted_by = $2,
             updated_at = now()
         WHERE id = $1 AND is_deleted = false`,
        [req.params.id, adminId],
      );
      if (!rowCount) throw NotFound('Toilette introuvable ou déjà supprimée');
      reply.code(204);
    },
  );
};

export default adminRoutes;

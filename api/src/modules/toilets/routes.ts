import { ADD_TOILET_MIN_DISTANCE_M } from '@poopedex/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { pool, withTransaction } from '../../db/pool';
import { Conflict, NotFound, TooManyRequests } from '../../lib/errors';
import { ensureAreaIngested } from '../../ingest/service';

const NearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(1).max(5000).default(1000), // mètres
});

const ToiletSummary = z.object({
  id: z.string(),
  name: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  distanceM: z.number(),
  avgOverall: z.number().nullable(),
  poopsCount: z.number(),
  collected: z.boolean(),
});

const CreateBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  name: z.string().max(120).optional(),
});

const toiletRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Toilettes autour d'un point. Auth optionnelle => flag `collected` si connecté.
  r.get(
    '/',
    { preHandler: app.optionalAuth, schema: { querystring: NearbyQuery, response: { 200: z.array(ToiletSummary) } } },
    async (req) => {
      const { lat, lng, radius } = req.query;
      const userId = req.user?.sub ?? null;

      // Ingestion OSM automatique (tuile centrale attendue, reste en fond).
      await ensureAreaIngested(lat, lng, radius).catch(() => {});

      const { rows } = await pool.query(
        `SELECT t.id,
                t.name,
                ST_Y(t.location::geometry) AS lat,
                ST_X(t.location::geometry) AS lng,
                ST_Distance(t.location, ST_MakePoint($2, $1)::geography) AS distance_m,
                t.avg_overall,
                t.poops_count,
                ($4::uuid IS NOT NULL AND EXISTS (
                   SELECT 1 FROM poops p WHERE p.toilet_id = t.id AND p.user_id = $4
                )) AS collected
         FROM toilets t
         WHERE t.status = 'active'
           AND ST_DWithin(t.location, ST_MakePoint($2, $1)::geography, $3)
         ORDER BY t.location <-> ST_MakePoint($2, $1)::geography
         LIMIT 500`,
        [lat, lng, radius, userId],
      );

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        distanceM: Math.round(Number(row.distance_m) * 10) / 10,
        avgOverall: row.avg_overall === null ? null : Number(row.avg_overall),
        poopsCount: Number(row.poops_count),
        collected: row.collected,
      }));
    },
  );

  // Détail d'une toilette + ses notes récentes.
  r.get(
    '/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req) => {
      const { rows } = await pool.query(
        `SELECT id, name, source, status,
                ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
                access, fee, wheelchair, unisex, changing_table,
                poops_count, ratings_count,
                avg_cleanliness, avg_safety, avg_hygiene, avg_inclusivity, avg_overall,
                last_rated_at
         FROM toilets WHERE id = $1`,
        [req.params.id],
      );
      const t = rows[0];
      if (!t) throw NotFound('Toilette introuvable');

      const { rows: recent } = await pool.query(
        `SELECT cleanliness, safety, hygiene_score, inclusivity_score, overall_score,
                has_soap, has_toilet_paper, has_bin, has_menstrual_products, has_baby_changing,
                comment, created_at
         FROM ratings WHERE toilet_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [req.params.id],
      );

      return { toilet: t, recentRatings: recent };
    },
  );

  // Ajout d'une toilette manquante (contribution user).
  // Règles : placée à la position de l'user (sur place), 1 ajout / 24 h,
  // refusée si une toilette existe déjà à moins de 100 m (anti-doublon).
  r.post(
    '/',
    { preHandler: app.authenticate, schema: { body: CreateBody } },
    async (req, reply) => {
      const { lat, lng, name } = req.body;
      const userId = req.user.sub;
      const id = uuidv7();

      await withTransaction(async (client) => {
        // Sérialise les ajouts d'un même user (anti-race sur la limite quotidienne).
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);

        const { rows: recent } = await client.query(
          `SELECT 1 FROM toilets
           WHERE created_by = $1 AND created_at > now() - interval '24 hours' LIMIT 1`,
          [userId],
        );
        if (recent.length) {
          throw TooManyRequests('daily_limit', 'Tu as déjà ajouté une toilette ces dernières 24 h.');
        }

        const { rows: near } = await client.query(
          `SELECT 1 FROM toilets
           WHERE status = 'active'
             AND ST_DWithin(location, ST_MakePoint($2, $1)::geography, $3) LIMIT 1`,
          [lat, lng, ADD_TOILET_MIN_DISTANCE_M],
        );
        if (near.length) {
          throw Conflict('duplicate_nearby', `Une toilette existe déjà à moins de ${ADD_TOILET_MIN_DISTANCE_M} m.`);
        }

        await client.query(
          `INSERT INTO toilets (id, source, location, name, created_by)
           VALUES ($1, 'user', ST_MakePoint($3, $2)::geography, $4, $5)`,
          [id, lat, lng, name ?? null, userId],
        );
      });

      reply.code(201);
      return { id };
    },
  );
};

export default toiletRoutes;

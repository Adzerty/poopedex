import { ADD_TOILET_MIN_DISTANCE_M, MAP_BBOX_MAX_SPAN_DEG } from '@poopedex/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { pool, withTransaction } from '../../db/pool';
import { BadRequest, Conflict, NotFound, TooManyRequests } from '../../lib/errors';
import { ensureAreaIngested, ensureBBoxIngested } from '../../ingest/service';
import { isAdmin } from '../../plugins/auth';

const NearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(1).max(5000).default(1000), // mètres
});

const BBoxQuery = z.object({
  south: z.coerce.number().min(-90).max(90),
  west: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
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

const LeaderboardQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const LeaderboardEntry = z.object({
  id: z.string(),
  name: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  avgOverall: z.number(),
  ratingsCount: z.number(),
  poopsCount: z.number(),
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
           AND t.is_deleted = false
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

  // Classement public des toilettes les mieux notées.
  // Tri : note moyenne ↓, puis nombre de votants ↓, puis nombre de poops ↓.
  // On ne liste que les toilettes ayant reçu au moins une note.
  r.get(
    '/leaderboard',
    { schema: { querystring: LeaderboardQuery, response: { 200: z.array(LeaderboardEntry) } } },
    async (req) => {
      const { limit } = req.query;
      const { rows } = await pool.query(
        `SELECT t.id,
                t.name,
                ST_Y(t.location::geometry) AS lat,
                ST_X(t.location::geometry) AS lng,
                t.avg_overall,
                t.ratings_count,
                t.poops_count
         FROM toilets t
         WHERE t.status = 'active'
           AND t.is_deleted = false
           AND t.avg_overall IS NOT NULL
           AND t.ratings_count > 0
         ORDER BY t.avg_overall DESC,
                  t.ratings_count DESC,
                  t.poops_count DESC,
                  t.id
         LIMIT $1`,
        [limit],
      );

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        avgOverall: Number(row.avg_overall),
        ratingsCount: Number(row.ratings_count),
        poopsCount: Number(row.poops_count),
      }));
    },
  );

  // Toilettes dans une bbox (viewport carto). Auth optionnelle pour `collected`.
  // Refuse les bbox trop larges (MAP_BBOX_MAX_SPAN_DEG) pour éviter qu'un client
  // charge « toutes les toilettes de France » d'un coup.
  r.get(
    '/bbox',
    { preHandler: app.optionalAuth, schema: { querystring: BBoxQuery, response: { 200: z.array(ToiletSummary) } } },
    async (req) => {
      const { south, west, north, east } = req.query;
      const userId = req.user?.sub ?? null;

      if (north <= south || east <= west) {
        throw BadRequest('invalid_bbox', 'BBox invalide (north>south, east>west attendu).');
      }
      if (north - south > MAP_BBOX_MAX_SPAN_DEG || east - west > MAP_BBOX_MAX_SPAN_DEG) {
        throw BadRequest('bbox_too_large', 'Zoome davantage pour charger les toilettes.');
      }

      const centerLat = (north + south) / 2;
      const centerLng = (east + west) / 2;

      // Ingestion OSM (tuile centrale attendue, voisines en fond), idempotente.
      await ensureBBoxIngested({ south, west, north, east }).catch(() => {});

      const { rows } = await pool.query(
        `SELECT t.id,
                t.name,
                ST_Y(t.location::geometry) AS lat,
                ST_X(t.location::geometry) AS lng,
                ST_Distance(t.location, ST_MakePoint($6, $5)::geography) AS distance_m,
                t.avg_overall,
                t.poops_count,
                ($7::uuid IS NOT NULL AND EXISTS (
                   SELECT 1 FROM poops p WHERE p.toilet_id = t.id AND p.user_id = $7
                )) AS collected
         FROM toilets t
         WHERE t.status = 'active'
           AND t.is_deleted = false
           AND ST_Intersects(t.location, ST_MakeEnvelope($2, $1, $4, $3, 4326)::geography)
         ORDER BY t.location <-> ST_MakePoint($6, $5)::geography
         LIMIT 500`,
        [south, west, north, east, centerLat, centerLng, userId],
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

  // Détail d'une toilette + agrégats des notes (moyennes par critère et % de
  // présence de chaque équipement) + 20 dernières notes.
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
         FROM toilets WHERE id = $1 AND is_deleted = false`,
        [req.params.id],
      );
      const t = rows[0];
      if (!t) throw NotFound('Toilette introuvable');

      const ratingsCount = Number(t.ratings_count);

      let flagsPct: Record<string, number> | null = null;
      if (ratingsCount > 0) {
        const { rows: agg } = await pool.query(
          `SELECT
             AVG(CASE WHEN has_soap THEN 1.0 ELSE 0 END)              AS soap,
             AVG(CASE WHEN has_toilet_paper THEN 1.0 ELSE 0 END)      AS paper,
             AVG(CASE WHEN has_bin THEN 1.0 ELSE 0 END)               AS bin,
             AVG(CASE WHEN has_menstrual_products THEN 1.0 ELSE 0 END) AS menstrual,
             AVG(CASE WHEN has_baby_changing THEN 1.0 ELSE 0 END)     AS baby
           FROM ratings WHERE toilet_id = $1`,
          [req.params.id],
        );
        const a = agg[0];
        const pct = (v: unknown) => Math.round(Number(v) * 100);
        flagsPct = {
          hasSoap: pct(a.soap),
          hasToiletPaper: pct(a.paper),
          hasBin: pct(a.bin),
          hasMenstrualProducts: pct(a.menstrual),
          hasBabyChanging: pct(a.baby),
        };
      }

      const { rows: recent } = await pool.query(
        `SELECT cleanliness, safety, hygiene_score, inclusivity_score, overall_score,
                has_soap, has_toilet_paper, has_bin, has_menstrual_products, has_baby_changing,
                comment, created_at
         FROM ratings WHERE toilet_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [req.params.id],
      );

      const num = (v: unknown) => (v === null ? null : Number(v));

      return {
        id: t.id,
        name: t.name,
        source: t.source,
        status: t.status,
        lat: Number(t.lat),
        lng: Number(t.lng),
        poopsCount: Number(t.poops_count),
        ratingsCount,
        avgCleanliness: num(t.avg_cleanliness),
        avgSafety: num(t.avg_safety),
        avgHygiene: num(t.avg_hygiene),
        avgInclusivity: num(t.avg_inclusivity),
        avgOverall: num(t.avg_overall),
        lastRatedAt: t.last_rated_at,
        flagsPct,
        recentRatings: recent,
      };
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
      const admin = await isAdmin(userId);

      await withTransaction(async (client) => {
        // Sérialise les ajouts d'un même user (anti-race sur la limite quotidienne).
        // Admin : pas de limite ni d'anti-doublon — il peut ajouter autant qu'il veut.
        if (!admin) {
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
             WHERE status = 'active' AND is_deleted = false
               AND ST_DWithin(location, ST_MakePoint($2, $1)::geography, $3) LIMIT 1`,
            [lat, lng, ADD_TOILET_MIN_DISTANCE_M],
          );
          if (near.length) {
            throw Conflict('duplicate_nearby', `Une toilette existe déjà à moins de ${ADD_TOILET_MIN_DISTANCE_M} m.`);
          }
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

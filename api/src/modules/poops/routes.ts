import { allowedCheckinRadius, computeScores } from '@poopedex/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { withTransaction } from '../../db/pool';
import { NotFound, Unprocessable } from '../../lib/errors';
import { evaluateBadges, getUserStats } from '../badges/service';

const RatingBody = z.object({
  cleanliness: z.number().int().min(1).max(5),
  safety: z.number().int().min(1).max(5),
  hasSoap: z.boolean().default(false),
  hasToiletPaper: z.boolean().default(false),
  hasBin: z.boolean().default(false),
  hasMenstrualProducts: z.boolean().default(false),
  hasBabyChanging: z.boolean().default(false),
  comment: z.string().max(500).optional(),
});

const CheckinBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().positive().max(10000).optional(), // précision GPS en mètres
  rating: RatingBody.optional(),
});

const poopRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Check-in sur une toilette. La distance est validée CÔTÉ SERVEUR.
  r.post(
    '/toilets/:id/poops',
    {
      preHandler: app.authenticate,
      schema: { params: z.object({ id: z.string().uuid() }), body: CheckinBody },
    },
    async (req, reply) => {
      const userId = req.user.sub;
      const toiletId = req.params.id;
      const { lat, lng, accuracy, rating } = req.body;

      return withTransaction(async (client) => {
        // Distance réelle toilette <-> position annoncée (en mètres).
        const { rows } = await client.query<{ distance_m: number | string; was_collected: boolean }>(
          `SELECT ST_Distance(location, ST_MakePoint($2, $1)::geography) AS distance_m,
                  EXISTS (SELECT 1 FROM poops WHERE toilet_id = $3 AND user_id = $4) AS was_collected
           FROM toilets WHERE id = $3 AND status = 'active'`,
          [lat, lng, toiletId, userId],
        );
        const row = rows[0];
        if (!row) throw NotFound('Toilette introuvable');

        const distanceM = Number(row.distance_m);
        const maxRadius = allowedCheckinRadius(accuracy);
        if (distanceM > maxRadius) {
          throw Unprocessable(
            'too_far',
            `Trop loin de la toilette (${Math.round(distanceM)} m, max ${Math.round(maxRadius)} m)`,
          );
        }

        // Enregistre le poop (le trigger incrémente poops_count).
        const poopId = uuidv7();
        await client.query(
          `INSERT INTO poops (id, user_id, toilet_id, checkin_loc, checkin_accuracy, distance_m)
           VALUES ($1, $2, $3, ST_MakePoint($5, $4)::geography, $6, $7)`,
          [poopId, userId, toiletId, lat, lng, accuracy ?? null, distanceM],
        );

        // Note optionnelle : scores calculés ici, le trigger agrège les moyennes.
        if (rating) {
          const scores = computeScores({
            cleanliness: rating.cleanliness,
            safety: rating.safety,
            hygiene: {
              hasSoap: rating.hasSoap,
              hasToiletPaper: rating.hasToiletPaper,
              hasBin: rating.hasBin,
            },
            inclusivity: {
              hasMenstrualProducts: rating.hasMenstrualProducts,
              hasBabyChanging: rating.hasBabyChanging,
            },
          });
          await client.query(
            `INSERT INTO ratings (id, poop_id, toilet_id, cleanliness, safety,
               has_soap, has_toilet_paper, has_bin, has_menstrual_products, has_baby_changing,
               hygiene_score, inclusivity_score, overall_score, comment)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [
              uuidv7(), poopId, toiletId, rating.cleanliness, rating.safety,
              rating.hasSoap, rating.hasToiletPaper, rating.hasBin,
              rating.hasMenstrualProducts, rating.hasBabyChanging,
              scores.hygieneScore, scores.inclusivityScore, scores.overallScore, rating.comment ?? null,
            ],
          );
        }

        const stats = await getUserStats(client, userId);
        const newBadges = await evaluateBadges(client, userId, stats);

        reply.code(201);
        return {
          poopId,
          newlyCollected: !row.was_collected, // première fois sur cette toilette
          distanceM: Math.round(distanceM * 10) / 10,
          stats,
          newBadges,
        };
      });
    },
  );
};

export default poopRoutes;

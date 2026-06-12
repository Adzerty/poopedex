import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { pool } from '../../db/pool';
import { BadRequest, Conflict, NotFound } from '../../lib/errors';

const UserRef = z.object({
  id: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
});

const FriendEntry = UserRef.extend({
  since: z.string(), // ISO
});

const PendingRequest = UserRef.extend({
  requestedAt: z.string(), // ISO
});

const SendRequestBody = z.object({
  userId: z.string().uuid(),
});

const UserIdParam = z.object({
  userId: z.string().uuid(),
});

/**
 * Convention : on stocke UNE seule ligne par paire d'utilisateurs dans `friendships`
 * (PRIMARY KEY (requester, addressee)). Une amitié peut donc apparaître dans un sens
 * ou dans l'autre selon qui a envoyé la demande — toutes les requêtes ci-dessous
 * tiennent compte de ça en testant les deux orientations.
 */
const friendRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Envoyer une demande d'ami.
  // Cas particuliers :
  //  - cible = moi → 400
  //  - amitié déjà acceptée → 409 already_friends
  //  - j'ai déjà une demande pending sortante → 409 request_pending
  //  - la cible m'a déjà envoyé une demande pending → on accepte direct (UX > strict)
  r.post(
    '/requests',
    {
      preHandler: app.authenticate,
      schema: { body: SendRequestBody, response: { 200: z.object({ status: z.enum(['pending', 'accepted']) }) } },
    },
    async (req) => {
      const me = req.user.sub;
      const other = req.body.userId;
      if (me === other) throw BadRequest('self_friend', 'Impossible de s\'ajouter soi-même');

      // Cible existe ?
      const { rowCount: exists } = await pool.query('SELECT 1 FROM users WHERE id = $1', [other]);
      if (!exists) throw NotFound('Utilisateur introuvable');

      // Lecture de l'éventuelle ligne existante dans n'importe quel sens.
      const { rows } = await pool.query<{ requester_id: string; addressee_id: string; status: string }>(
        `SELECT requester_id, addressee_id, status
         FROM friendships
         WHERE (requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1)`,
        [me, other],
      );
      const existing = rows[0];

      if (existing?.status === 'accepted') throw Conflict('already_friends', 'Vous êtes déjà amis');
      if (existing?.status === 'blocked') throw Conflict('blocked', 'Action impossible');

      if (existing?.status === 'pending') {
        // Si la demande pending vient de la cible vers moi → acceptation immédiate.
        if (existing.requester_id === other) {
          await pool.query(
            `UPDATE friendships SET status = 'accepted', updated_at = now()
             WHERE requester_id = $1 AND addressee_id = $2`,
            [other, me],
          );
          return { status: 'accepted' as const };
        }
        // Sinon c'est moi qui ai déjà demandé.
        throw Conflict('request_pending', 'Demande déjà envoyée');
      }

      await pool.query(
        `INSERT INTO friendships (requester_id, addressee_id, status)
         VALUES ($1, $2, 'pending')`,
        [me, other],
      );
      return { status: 'pending' as const };
    },
  );

  // Mes amis (acceptés). On agrège les deux sens en une seule liste.
  r.get(
    '/',
    {
      preHandler: app.authenticate,
      schema: { response: { 200: z.array(FriendEntry) } },
    },
    async (req) => {
      const me = req.user.sub;
      const { rows } = await pool.query(
        `SELECT u.id, u.username, u.avatar_url,
                f.updated_at AS since
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
         WHERE f.status = 'accepted'
           AND (f.requester_id = $1 OR f.addressee_id = $1)
         ORDER BY u.username ASC`,
        [me],
      );
      return rows.map((row) => ({
        id: row.id,
        username: row.username,
        avatarUrl: row.avatar_url,
        since: row.since.toISOString(),
      }));
    },
  );

  // Demandes reçues (moi = addressee, pending).
  r.get(
    '/requests',
    {
      preHandler: app.authenticate,
      schema: { response: { 200: z.array(PendingRequest) } },
    },
    async (req) => {
      const me = req.user.sub;
      const { rows } = await pool.query(
        `SELECT u.id, u.username, u.avatar_url, f.created_at AS requested_at
         FROM friendships f
         JOIN users u ON u.id = f.requester_id
         WHERE f.addressee_id = $1 AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [me],
      );
      return rows.map((row) => ({
        id: row.id,
        username: row.username,
        avatarUrl: row.avatar_url,
        requestedAt: row.requested_at.toISOString(),
      }));
    },
  );

  // Demandes envoyées (moi = requester, pending). Utile pour l'UI.
  r.get(
    '/requests/sent',
    {
      preHandler: app.authenticate,
      schema: { response: { 200: z.array(PendingRequest) } },
    },
    async (req) => {
      const me = req.user.sub;
      const { rows } = await pool.query(
        `SELECT u.id, u.username, u.avatar_url, f.created_at AS requested_at
         FROM friendships f
         JOIN users u ON u.id = f.addressee_id
         WHERE f.requester_id = $1 AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [me],
      );
      return rows.map((row) => ({
        id: row.id,
        username: row.username,
        avatarUrl: row.avatar_url,
        requestedAt: row.requested_at.toISOString(),
      }));
    },
  );

  // Accepter une demande reçue.
  r.post(
    '/requests/:userId/accept',
    { preHandler: app.authenticate, schema: { params: UserIdParam } },
    async (req, reply) => {
      const me = req.user.sub;
      const { rowCount } = await pool.query(
        `UPDATE friendships SET status = 'accepted', updated_at = now()
         WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
        [req.params.userId, me],
      );
      if (!rowCount) throw NotFound('Aucune demande en attente');
      reply.code(204);
    },
  );

  // Refuser une demande reçue (supprime la ligne).
  r.post(
    '/requests/:userId/decline',
    { preHandler: app.authenticate, schema: { params: UserIdParam } },
    async (req, reply) => {
      const me = req.user.sub;
      const { rowCount } = await pool.query(
        `DELETE FROM friendships
         WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
        [req.params.userId, me],
      );
      if (!rowCount) throw NotFound('Aucune demande en attente');
      reply.code(204);
    },
  );

  // Retirer un ami OU annuler une demande sortante (peu importe le sens en base).
  r.delete(
    '/:userId',
    { preHandler: app.authenticate, schema: { params: UserIdParam } },
    async (req, reply) => {
      const me = req.user.sub;
      const { rowCount } = await pool.query(
        `DELETE FROM friendships
         WHERE ((requester_id = $1 AND addressee_id = $2)
             OR (requester_id = $2 AND addressee_id = $1))
           AND status IN ('pending', 'accepted')`,
        [me, req.params.userId],
      );
      if (!rowCount) throw NotFound('Aucune relation à supprimer');
      reply.code(204);
    },
  );
};

export default friendRoutes;

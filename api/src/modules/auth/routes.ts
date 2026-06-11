import { hash, verify } from '@node-rs/argon2';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { pool } from '../../db/pool';
import { Conflict, Unauthorized } from '../../lib/errors';
import { issueTokens } from '../../lib/tokens';

const RegisterBody = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'alphanumérique + underscore'),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

const LoginBody = z.object({
  // pseudo OU email
  identifier: z.string().min(3),
  password: z.string().min(1),
});

const RefreshBody = z.object({
  refreshToken: z.string().min(10),
});

const TokensReply = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({ id: z.string(), username: z.string() }),
});

const authRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/register', { schema: { body: RegisterBody, response: { 201: TokensReply } } }, async (req, reply) => {
    const { username, email, password } = req.body;

    const exists = await pool.query('SELECT 1 FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (exists.rowCount) throw Conflict('user_exists', 'Pseudo ou email déjà utilisé');

    const id = uuidv7();
    const passwordHash = await hash(password);
    await pool.query(
      'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
      [id, username, email, passwordHash],
    );

    reply.code(201);
    return { ...issueTokens(app, id), user: { id, username } };
  });

  r.post('/login', { schema: { body: LoginBody, response: { 200: TokensReply } } }, async (req) => {
    const { identifier, password } = req.body;
    const { rows } = await pool.query<{ id: string; username: string; password_hash: string }>(
      'SELECT id, username, password_hash FROM users WHERE username = $1 OR email = $1',
      [identifier],
    );
    const user = rows[0];
    // Toujours vérifier un hash (même bidon) pour limiter le timing-oracle d'énumération.
    const ok = user
      ? await verify(user.password_hash, password)
      : (await verify('$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$0000000000000000000000000000000000000000000', password).catch(() => false), false);
    if (!user || !ok) throw Unauthorized('Identifiants invalides');

    return { ...issueTokens(app, user.id), user: { id: user.id, username: user.username } };
  });

  // NOTE v1 : pas de révocation serveur des refresh tokens (pas de table de sessions).
  // À ajouter (rotation + liste de révocation) avant la prod si besoin de logout forcé.
  r.post('/refresh', { schema: { body: RefreshBody, response: { 200: TokensReply } } }, async (req) => {
    let sub: string;
    try {
      const payload = app.jwt.verify<{ sub: string; typ: string }>(req.body.refreshToken);
      if (payload.typ !== 'refresh') throw new Error('wrong type');
      sub = payload.sub;
    } catch {
      throw Unauthorized('Refresh token invalide');
    }
    const { rows } = await pool.query<{ username: string }>('SELECT username FROM users WHERE id = $1', [sub]);
    const user = rows[0];
    if (!user) throw Unauthorized('Utilisateur introuvable');
    return { ...issueTokens(app, sub), user: { id: sub, username: user.username } };
  });
};

export default authRoutes;

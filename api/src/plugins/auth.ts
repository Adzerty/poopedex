import fastifyJwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../config';
import { pool } from '../db/pool';
import { AppError, Unauthorized } from '../lib/errors';

/** Contenu du JWT. `typ` distingue access et refresh pour éviter qu'un refresh serve d'access. */
export interface JwtPayload {
  sub: string; // user id
  typ: 'access' | 'refresh';
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler : exige un access token valide, peuple request.user. */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** preHandler : peuple request.user si un token est présent, sans l'exiger. */
    optionalAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** preHandler : exige un access token ET le flag is_admin en base. */
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  await app.register(fastifyJwt, { secret: config.JWT_SECRET });

  app.decorate('authenticate', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw Unauthorized();
    }
    if (req.user.typ !== 'access') throw Unauthorized('Token invalide');
  });

  app.decorate('optionalAuth', async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header) return;
    try {
      await req.jwtVerify();
      if (req.user.typ !== 'access') (req as { user?: unknown }).user = undefined;
    } catch {
      // token absent/invalide => on reste anonyme, pas d'erreur
    }
  });

  app.decorate('requireAdmin', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw Unauthorized();
    }
    if (req.user.typ !== 'access') throw Unauthorized('Token invalide');
    if (!(await isAdmin(req.user.sub))) throw new AppError(403, 'forbidden', 'Réservé aux admins');
  });
};

/** Vérifie le flag is_admin en base. Cache court possible plus tard si besoin. */
export async function isAdmin(userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ is_admin: boolean }>(
    'SELECT is_admin FROM users WHERE id = $1',
    [userId],
  );
  return rows[0]?.is_admin === true;
}

export default fp(authPlugin, { name: 'auth' });

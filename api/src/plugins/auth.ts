import fastifyJwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../config';
import { Unauthorized } from '../lib/errors';

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
};

export default fp(authPlugin, { name: 'auth' });

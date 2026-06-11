import type { FastifyInstance } from 'fastify';
import { config } from '../config';

/** Émet une paire access + refresh pour un user donné. */
export function issueTokens(app: FastifyInstance, userId: string) {
  const accessToken = app.jwt.sign({ sub: userId, typ: 'access' }, { expiresIn: config.ACCESS_TOKEN_TTL });
  const refreshToken = app.jwt.sign({ sub: userId, typ: 'refresh' }, { expiresIn: config.REFRESH_TOKEN_TTL });
  return { accessToken, refreshToken };
}

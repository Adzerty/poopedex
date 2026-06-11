import cors from '@fastify/cors';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { AppError } from './lib/errors';
import authPlugin from './plugins/auth';
import authRoutes from './modules/auth/routes';
import poopRoutes from './modules/poops/routes';
import toiletRoutes from './modules/toilets/routes';
import userRoutes from './modules/users/routes';

export async function buildServer() {
  const app = Fastify({
    logger: { transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' } },
  }).withTypeProvider<ZodTypeProvider>();

  // Validation/sérialisation pilotées par Zod.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Réponses d'erreur homogènes.
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: err.code, message: err.message });
    }
    if (err instanceof ZodError || (err as { validation?: unknown }).validation) {
      return reply
        .code(400)
        .send({ error: 'validation_error', message: (err as Error).message, details: (err as ZodError).issues });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'internal_error', message: 'Erreur interne' });
  });

  // CORS : permissif en dev, à restreindre en prod via une allowlist d'origines.
  await app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authPlugin);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(toiletRoutes, { prefix: '/toilets' });
  await app.register(poopRoutes); // routes /toilets/:id/poops
  await app.register(userRoutes, { prefix: '/users' });

  return app;
}

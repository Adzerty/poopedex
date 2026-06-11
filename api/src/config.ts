import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET doit faire au moins 16 caractères'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const config = schema.parse(process.env);
export type Config = z.infer<typeof schema>;

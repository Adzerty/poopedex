import 'dotenv/config';
import { config } from './config';
import { pool } from './db/pool';
import { buildServer } from './server';

const app = await buildServer();

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Arrêt propre : ferme le serveur puis le pool PG.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}

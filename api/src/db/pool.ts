import pg from 'pg';
import { config } from '../config';

// node-postgres renvoie les BIGINT en string par défaut (pas de perte) ;
// les REAL/NUMERIC d'agrégat reviennent aussi en string — on les caste côté requête.
export const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

export type Db = pg.Pool | pg.PoolClient;

/** Exécute `fn` dans une transaction, avec COMMIT/ROLLBACK automatique. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

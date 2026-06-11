/**
 * Ingestion OSM manuelle d'une zone (dev / seed).
 *   pnpm --filter @poopedex/api ingest -- <lat> <lng> [rayon_m]
 * ex: pnpm --filter @poopedex/api ingest -- 48.8566 2.3522 1500
 */
import 'dotenv/config';
import { pool } from '../src/db/pool';
import { ingestAreaBlocking } from '../src/ingest/service';

const [latArg, lngArg, radiusArg] = process.argv.slice(2).filter((a) => a !== '--');
const lat = Number(latArg);
const lng = Number(lngArg);
const radius = radiusArg ? Number(radiusArg) : 1500;

if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
  console.error('Usage: ingest -- <lat> <lng> [rayon_m]');
  process.exit(1);
}

const tiles = await ingestAreaBlocking(lat, lng, radius);

const { rows } = await pool.query(
  `SELECT count(*) FROM toilets
   WHERE ST_DWithin(location, ST_MakePoint($2, $1)::geography, $3)`,
  [lat, lng, radius],
);
console.log(`✓ ${tiles} tuile(s) ingérée(s). ${rows[0].count} toilette(s) dans le rayon de ${radius} m.`);
await pool.end();

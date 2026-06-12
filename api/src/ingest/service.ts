import { pool } from "../db/pool";
import { fetchToilets, type OsmToilet } from "./overpass";
import {
  coveringTiles,
  coveringTilesForBBox,
  tileToBBox,
  type BBox,
  type Tile,
} from "./tiles";

/** Fraîcheur du cache d'une tuile : on ne re-fetch Overpass qu'au-delà. */
const TILE_TTL_DAYS = 7;

/** Délai max d'attente de la tuile centrale dans le flux d'une requête carte. */
const CENTER_INGEST_TIMEOUT_MS = 4000;

// Évite de fetch deux fois la même tuile en parallèle (requêtes concurrentes).
const inFlight = new Set<string>();
const tileKey = (t: Tile) => `${t.z}/${t.x}/${t.y}`;

function parseBool(v: string | undefined): boolean | null {
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

async function upsertToilets(list: OsmToilet[]): Promise<void> {
  for (const t of list) {
    // Anti-résurrection : si la toilette OSM avait été soft-deletée par un admin,
    // on saute carrément l'upsert (sinon le ON CONFLICT mettrait à jour les tags
    // mais le WHERE is_deleted=false côté lecture la masquerait — autant éviter
    // le bruit en base et garder is_deleted=true intact).
    await pool.query(
      `INSERT INTO toilets (id, source, osm_type, osm_id, location, name,
                            access, fee, wheelchair, unisex, changing_table, raw_tags)
       VALUES (gen_random_uuid(), 'osm', $1, $2, ST_MakePoint($4, $3)::geography, $5,
               $6, $7, $8, $9, $10, $11)
       ON CONFLICT (osm_type, osm_id) DO UPDATE SET
         location       = EXCLUDED.location,
         name           = EXCLUDED.name,
         access         = EXCLUDED.access,
         fee            = EXCLUDED.fee,
         wheelchair     = EXCLUDED.wheelchair,
         unisex         = EXCLUDED.unisex,
         changing_table = EXCLUDED.changing_table,
         raw_tags       = EXCLUDED.raw_tags,
         updated_at     = now()
       WHERE toilets.is_deleted = false`,
      [
        t.osmType,
        t.osmId,
        t.lat,
        t.lng,
        t.tags.name ?? null,
        t.tags.access ?? null,
        parseBool(t.tags.fee),
        parseBool(t.tags.wheelchair),
        parseBool(t.tags.unisex),
        parseBool(t.tags.changing_table),
        JSON.stringify(t.tags),
      ]
    );
  }
}

/** Ingère une tuile si le cache est absent/périmé. No-op si fraîche ou déjà en cours. */
async function ingestTile(tile: Tile): Promise<void> {
  const key = tileKey(tile);
  if (inFlight.has(key)) return;

  const { rows } = await pool.query(
    `SELECT 1 FROM osm_ingest_tiles
     WHERE z = $1 AND x = $2 AND y = $3 AND fetched_at > now() - ($4 || ' days')::interval`,
    [tile.z, tile.x, tile.y, String(TILE_TTL_DAYS)]
  );
  if (rows.length) return; // cache encore frais

  inFlight.add(key);
  try {
    const toilets = await fetchToilets(tileToBBox(tile));
    await upsertToilets(toilets);
    await pool.query(
      `INSERT INTO osm_ingest_tiles (z, x, y, fetched_at, toilet_count)
       VALUES ($1, $2, $3, now(), $4)
       ON CONFLICT (z, x, y) DO UPDATE SET fetched_at = now(), toilet_count = EXCLUDED.toilet_count`,
      [tile.z, tile.x, tile.y, toilets.length]
    );
  } finally {
    inFlight.delete(key);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([
    p,
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

/**
 * Appelé sur la requête carte : ingère la tuile centrale (attendue, avec garde de
 * temps) pour des données immédiates, et lance le reste en arrière-plan.
 * Toujours résiliente : un Overpass lent/HS ne bloque jamais la réponse.
 */
export async function ensureAreaIngested(
  lat: number,
  lng: number,
  radiusM: number
): Promise<void> {
  const tiles = coveringTiles(lat, lng, radiusM);
  if (tiles.length === 0) return;

  const center = tiles[0]!;
  await withTimeout(
    ingestTile(center).catch(() => {}),
    CENTER_INGEST_TIMEOUT_MS
  );
  for (const tile of tiles.slice(1)) {
    void ingestTile(tile).catch(() => {});
  }
}

/**
 * Variante bbox : ingère la tuile centrale (attendue, garde de temps) et lance
 * le reste en arrière-plan. Utilisée par la requête carte qui passe le viewport.
 */
export async function ensureBBoxIngested(bbox: BBox): Promise<void> {
  const tiles = coveringTilesForBBox(bbox);
  if (tiles.length === 0) return;

  const center = tiles[0]!;
  await withTimeout(
    ingestTile(center).catch(() => {}),
    CENTER_INGEST_TIMEOUT_MS
  );
  for (const tile of tiles.slice(1)) {
    void ingestTile(tile).catch(() => {});
  }
}

/** Version bloquante (CLI / seed) : ingère toutes les tuiles et attend la fin. */
export async function ingestAreaBlocking(
  lat: number,
  lng: number,
  radiusM: number
): Promise<number> {
  const tiles = coveringTiles(lat, lng, radiusM);
  for (const tile of tiles) {
    await ingestTile(tile);
  }
  return tiles.length;
}

import { OSM_INGEST_ZOOM } from '@poopedex/shared';

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

function lngToTileX(lng: number, z: number): number {
  return ((lng + 180) / 360) * 2 ** z;
}

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * 2 ** z;
}

function tileXToLng(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

function tileYToLat(y: number, z: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;
}

/**
 * Snape la bbox aux frontières de tuiles z=14 (zoom d'ingestion serveur).
 * → Pour deux pans de doigt qui restent dans les mêmes tuiles, on a la même
 * clé de cache React Query, donc 0 refetch et 0 appel API.
 */
export function snapBBoxToTiles(bbox: BBox, z = OSM_INGEST_ZOOM): BBox {
  const x0 = Math.floor(lngToTileX(bbox.west, z));
  const x1 = Math.floor(lngToTileX(bbox.east, z)) + 1;
  // En tuiles slippy, y croît du nord (0) vers le sud → north a le y le plus petit.
  const y0 = Math.floor(latToTileY(bbox.north, z));
  const y1 = Math.floor(latToTileY(bbox.south, z)) + 1;
  return {
    west: tileXToLng(x0, z),
    east: tileXToLng(x1, z),
    north: tileYToLat(y0, z),
    south: tileYToLat(y1, z),
  };
}

/** Clé canonique pour React Query : déterministe à 5 décimales (~1 m). */
export function bboxKey(bbox: BBox): string {
  const r = (n: number) => n.toFixed(5);
  return `${r(bbox.south)},${r(bbox.west)},${r(bbox.north)},${r(bbox.east)}`;
}

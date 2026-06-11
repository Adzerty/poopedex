import { OSM_INGEST_ZOOM } from '@poopedex/shared';

export interface Tile {
  z: number;
  x: number;
  y: number;
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** (lat,lng) → tuile slippy-map au zoom donné. */
export function lngLatToTile(lat: number, lng: number, z = OSM_INGEST_ZOOM): Tile {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return { z, x, y };
}

/** Tuile → bounding box géographique. */
export function tileToBBox({ z, x, y }: Tile): BBox {
  const n = 2 ** z;
  const lng = (xx: number) => (xx / n) * 360 - 180;
  const lat = (yy: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) * 180) / Math.PI;
  return { west: lng(x), east: lng(x + 1), north: lat(y), south: lat(y + 1) };
}

/**
 * Tuiles couvrant un cercle (lat,lng,rayon m), la tuile centrale en premier.
 * Plafonné pour éviter une explosion sur un grand rayon.
 */
export function coveringTiles(lat: number, lng: number, radiusM: number, z = OSM_INGEST_ZOOM): Tile[] {
  const degLat = radiusM / 111_320;
  const degLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const topLeft = lngLatToTile(lat + degLat, lng - degLng, z);
  const bottomRight = lngLatToTile(lat - degLat, lng + degLng, z);
  const center = lngLatToTile(lat, lng, z);

  const tiles: Tile[] = [];
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tiles.push({ z, x, y });
    }
  }
  // Distance de Manhattan à la tuile centrale → on ingère le centre d'abord.
  tiles.sort(
    (a, b) =>
      Math.abs(a.x - center.x) + Math.abs(a.y - center.y) - (Math.abs(b.x - center.x) + Math.abs(b.y - center.y)),
  );
  return tiles.slice(0, 16);
}

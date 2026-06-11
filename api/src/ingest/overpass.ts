import type { BBox } from './tiles';

const ENDPOINT = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';

export interface OsmToilet {
  osmType: 'n' | 'w' | 'r';
  osmId: number;
  lat: number;
  lng: number;
  tags: Record<string, string>;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Récupère les `amenity=toilets` (nodes/ways/relations) dans une bbox via Overpass. */
export async function fetchToilets(bbox: BBox): Promise<OsmToilet[]> {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const query = `[out:json][timeout:25];(node["amenity"="toilets"](${b});way["amenity"="toilets"](${b});relation["amenity"="toilets"](${b}););out center tags;`;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'Poopedex/0.1 (https://github.com/poopedex; dev)',
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);

  const data = (await res.json()) as { elements: OverpassElement[] };
  const out: OsmToilet[] = [];
  for (const el of data.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    out.push({ osmType: el.type[0] as 'n' | 'w' | 'r', osmId: el.id, lat, lng, tags: el.tags ?? {} });
  }
  return out;
}

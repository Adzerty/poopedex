/**
 * Constantes géospatiales partagées (check-in, ingestion).
 */

/** Rayon de base autorisé pour valider un check-in, en mètres. */
export const CHECKIN_BASE_RADIUS_M = 30;

/** Plafond du rayon autorisé même avec un GPS très imprécis, en mètres. */
export const CHECKIN_MAX_RADIUS_M = 50;

/**
 * Rayon autorisé pour un check-in, en fonction de la précision GPS annoncée.
 * Le client ne décide jamais : ce calcul est rejoué côté serveur.
 */
export function allowedCheckinRadius(gpsAccuracyM: number | null | undefined): number {
  const accuracy = gpsAccuracyM && gpsAccuracyM > 0 ? gpsAccuracyM : 0;
  return Math.min(CHECKIN_BASE_RADIUS_M + accuracy, CHECKIN_MAX_RADIUS_M);
}

/** Zoom des tuiles de cache d'ingestion OSM (~maille de quartier). */
export const OSM_INGEST_ZOOM = 14;

/**
 * Zoom minimum à partir duquel on affiche/fetch les toilettes sur la carte.
 * En-dessous, marqueurs masqués et aucun fetch — évite de noyer la carte et
 * de matraquer le serveur/Overpass avec des bbox gigantesques.
 */
export const MAP_FETCH_MIN_ZOOM = 13;

/**
 * Bbox max acceptée par /toilets/bbox (degrés). Au-delà → 400, pour qu'un client
 * (bug ou abus) ne puisse pas demander « toutes les toilettes de France ».
 * 0.6° ≈ 66 km en longueur d'arc → couvre une viewport phone à z13 avec marge.
 */
export const MAP_BBOX_MAX_SPAN_DEG = 0.6;

/** Distance minimale (m) entre une toilette ajoutée par un user et une existante (anti-doublon). */
export const ADD_TOILET_MIN_DISTANCE_M = 100;

/** Nombre d'ajouts de toilette autorisés par user sur une fenêtre glissante de 24 h. */
export const ADD_TOILET_DAILY_LIMIT = 1;

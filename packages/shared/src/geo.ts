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

/** Distance minimale (m) entre une toilette ajoutée par un user et une existante (anti-doublon). */
export const ADD_TOILET_MIN_DISTANCE_M = 100;

/** Nombre d'ajouts de toilette autorisés par user sur une fenêtre glissante de 24 h. */
export const ADD_TOILET_DAILY_LIMIT = 1;

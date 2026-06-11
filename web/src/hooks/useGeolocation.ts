import { useEffect, useState } from 'react';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number; // mètres
}

interface GeoState {
  position: GeoPosition | null;
  error: string | null;
  loading: boolean;
}

/**
 * Suit la position de l'utilisateur en continu (watchPosition).
 * `accuracy` alimente la règle de rayon de check-in côté UI.
 */
export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({ position: null, error: null, loading: true });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState({ position: null, error: 'Géolocalisation non supportée', loading: false });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
          error: null,
          loading: false,
        });
      },
      (err) => setState((s) => ({ ...s, error: err.message, loading: false })),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return state;
}

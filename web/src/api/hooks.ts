import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { CheckinResult, Profile, RatingInput, ToiletSummary } from './types';
import type { GeoPosition } from '../hooks/useGeolocation';

export function useNearbyToilets(pos: GeoPosition | null, radius = 1000) {
  return useQuery({
    queryKey: ['toilets', pos && roundKey(pos), radius],
    enabled: !!pos,
    queryFn: () =>
      api<ToiletSummary[]>(`/toilets?lat=${pos!.lat}&lng=${pos!.lng}&radius=${radius}`),
    staleTime: 30_000,
  });
}

export function useProfile() {
  return useQuery({ queryKey: ['me'], queryFn: () => api<Profile>('/users/me') });
}

export function useAddToilet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { lat: number; lng: number; name?: string }) =>
      api<{ id: string }>('/toilets', { method: 'POST', body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['toilets'] }),
  });
}

export function useCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { toiletId: string; lat: number; lng: number; accuracy?: number; rating?: RatingInput }) =>
      api<CheckinResult>(`/toilets/${vars.toiletId}/poops`, {
        method: 'POST',
        body: { lat: vars.lat, lng: vars.lng, accuracy: vars.accuracy, rating: vars.rating },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['toilets'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// Évite de refetch à chaque micro-déplacement GPS : on arrondit la clé de cache.
function roundKey(pos: GeoPosition): string {
  return `${pos.lat.toFixed(3)},${pos.lng.toFixed(3)}`;
}

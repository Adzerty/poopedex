import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  AdminToilet,
  AdminUser,
  CheckinResult,
  Friend,
  FriendRequest,
  LeaderboardEntry,
  Profile,
  RatingInput,
  ToiletDetail,
  ToiletSummary,
  UserLeaderboardEntry,
} from './types';
import type { GeoPosition } from '../hooks/useGeolocation';
import { bboxKey, type BBox } from '../lib/bbox';

export function useNearbyToilets(pos: GeoPosition | null, radius = 1000) {
  return useQuery({
    queryKey: ['toilets', pos && roundKey(pos), radius],
    enabled: !!pos,
    queryFn: () =>
      api<ToiletSummary[]>(`/toilets?lat=${pos!.lat}&lng=${pos!.lng}&radius=${radius}`),
    staleTime: 30_000,
  });
}

/**
 * Toilettes dans le viewport carto. La bbox doit être pré-snappée sur la grille
 * de tuiles z=14 (cf. `snapBBoxToTiles`) → un pan qui reste dans la même tuile
 * produit la même clé de cache et ne refetch pas.
 *
 * `enabled` doit être `false` quand le zoom est trop faible (sinon on demanderait
 * des bbox géantes au serveur).
 */
export function useToiletsInBBox(bbox: BBox | null, enabled: boolean) {
  return useQuery({
    queryKey: ['toilets', 'bbox', bbox && bboxKey(bbox)],
    enabled: enabled && !!bbox,
    queryFn: () => {
      const b = bbox!;
      const qs = `south=${b.south}&west=${b.west}&north=${b.north}&east=${b.east}`;
      return api<ToiletSummary[]>(`/toilets/bbox?${qs}`);
    },
    // Les toilettes ne bougent pas en temps réel → on garde la réponse fraîche
    // 5 min, ça absorbe tous les pans/zooms dans le même secteur sans refetch.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useToiletDetail(toiletId: string | null) {
  return useQuery({
    queryKey: ['toilet', toiletId],
    enabled: !!toiletId,
    queryFn: () => api<ToiletDetail>(`/toilets/${toiletId}`),
    staleTime: 30_000,
  });
}

export function useLeaderboard(limit = 50) {
  return useQuery({
    queryKey: ['toilets', 'leaderboard', limit],
    queryFn: () => api<LeaderboardEntry[]>(`/toilets/leaderboard?limit=${limit}`),
    staleTime: 60_000,
  });
}

export type LeaderboardScope = 'global' | 'friends';

export function useUsersLeaderboard(scope: LeaderboardScope = 'global', limit = 100) {
  return useQuery({
    queryKey: ['users', 'leaderboard', scope, limit],
    queryFn: () =>
      api<UserLeaderboardEntry[]>(`/users/leaderboard?limit=${limit}&scope=${scope}`),
    staleTime: 60_000,
  });
}

export function useFriends() {
  return useQuery({ queryKey: ['friends'], queryFn: () => api<Friend[]>('/friends') });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: ['friends', 'requests'],
    queryFn: () => api<FriendRequest[]>('/friends/requests'),
  });
}

export function useSentFriendRequests() {
  return useQuery({
    queryKey: ['friends', 'requests', 'sent'],
    queryFn: () => api<FriendRequest[]>('/friends/requests/sent'),
  });
}

/**
 * Toutes les mutations d'amitié invalident les mêmes caches : la liste d'amis,
 * les demandes reçues/envoyées, le leaderboard amis, et — si on connaît la
 * cible — le profil concerné (qui porte `friendshipStatus`).
 */
function useFriendshipMutation<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
  getTargetId?: (vars: TVars) => string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['friends'] });
      qc.invalidateQueries({ queryKey: ['users', 'leaderboard', 'friends'] });
      const id = getTargetId?.(vars);
      if (id) qc.invalidateQueries({ queryKey: ['user', id] });
    },
  });
}

export function useSendFriendRequest() {
  return useFriendshipMutation(
    (userId: string) =>
      api<{ status: 'pending' | 'accepted' }>('/friends/requests', {
        method: 'POST',
        body: { userId },
      }),
    (userId) => userId,
  );
}

export function useAcceptFriendRequest() {
  return useFriendshipMutation(
    (userId: string) =>
      api<void>(`/friends/requests/${userId}/accept`, { method: 'POST' }),
    (userId) => userId,
  );
}

export function useDeclineFriendRequest() {
  return useFriendshipMutation(
    (userId: string) =>
      api<void>(`/friends/requests/${userId}/decline`, { method: 'POST' }),
    (userId) => userId,
  );
}

export function useRemoveFriend() {
  return useFriendshipMutation(
    (userId: string) => api<void>(`/friends/${userId}`, { method: 'DELETE' }),
    (userId) => userId,
  );
}

export function useProfile() {
  return useQuery({ queryKey: ['me'], queryFn: () => api<Profile>('/users/me') });
}

export function useUserProfile(userId: string | null) {
  return useQuery({
    queryKey: ['user', userId],
    enabled: !!userId,
    queryFn: () => api<Profile>(`/users/${userId}`),
  });
}

export function useAdminToilets() {
  return useQuery({
    queryKey: ['admin', 'toilets'],
    queryFn: () => api<AdminToilet[]>('/admin/toilets'),
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api<AdminUser[]>('/admin/users'),
  });
}

export function useDeleteToilet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (toiletId: string) =>
      api<void>(`/admin/toilets/${toiletId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['toilets'] });
      qc.invalidateQueries({ queryKey: ['admin', 'toilets'] });
    },
  });
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
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['toilets'] });
      qc.invalidateQueries({ queryKey: ['toilet', vars.toiletId] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// Évite de refetch à chaque micro-déplacement GPS : on arrondit la clé de cache.
function roundKey(pos: GeoPosition): string {
  return `${pos.lat.toFixed(3)},${pos.lng.toFixed(3)}`;
}

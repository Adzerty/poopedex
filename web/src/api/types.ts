export interface ToiletSummary {
  id: string;
  name: string | null;
  lat: number;
  lng: number;
  distanceM: number;
  avgOverall: number | null;
  poopsCount: number;
  collected: boolean;
}

export interface ToiletFlagsPct {
  hasSoap: number;
  hasToiletPaper: number;
  hasBin: number;
  hasMenstrualProducts: number;
  hasBabyChanging: number;
}

export interface ToiletDetail {
  id: string;
  name: string | null;
  source: 'osm' | 'user';
  status: string;
  lat: number;
  lng: number;
  poopsCount: number;
  ratingsCount: number;
  avgCleanliness: number | null;
  avgSafety: number | null;
  avgHygiene: number | null;
  avgInclusivity: number | null;
  avgOverall: number | null;
  lastRatedAt: string | null;
  flagsPct: ToiletFlagsPct | null;
}

export interface RatingInput {
  cleanliness: number;
  safety: number;
  hasSoap: boolean;
  hasToiletPaper: boolean;
  hasBin: boolean;
  hasMenstrualProducts: boolean;
  hasBabyChanging: boolean;
  comment?: string;
}

export interface CheckinResult {
  poopId: string;
  newlyCollected: boolean;
  distanceM: number;
  rarityScore: number;
  stats: UserStats;
  newBadges: { code: string; name: string }[];
}

export interface UserStats {
  totalPoops: number;
  distinctToilets: number;
  totalRatings: number;
  totalPoints: number;
  maxRarityScore: number;
}

export interface Badge {
  code: string;
  name: string;
  description: string;
  icon: string | null;
  /** `null` si le badge n'est pas encore débloqué pour ce profil. */
  unlockedAt: string | null;
  /** Avancement vers le critère du badge (clamp côté UI). */
  progress: { current: number; target: number };
}

export type FriendshipStatus =
  | 'none'
  | 'self'
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'accepted';

export interface Profile {
  id: string;
  username: string;
  avatarUrl: string | null;
  memberSince: string;
  isAdmin?: boolean;
  stats: UserStats;
  badges: Badge[];
  /** `null` quand on lit le profil sans être authentifié. */
  friendshipStatus: FriendshipStatus | null;
}

export interface Friend {
  id: string;
  username: string;
  avatarUrl: string | null;
  since: string;
}

export interface FriendRequest {
  id: string;
  username: string;
  avatarUrl: string | null;
  requestedAt: string;
}

export interface AdminToilet {
  id: string;
  name: string | null;
  source: 'osm' | 'user';
  status: string;
  isDeleted: boolean;
  lat: number;
  lng: number;
  poopsCount: number;
  ratingsCount: number;
  avgOverall: number | null;
  createdAt: string;
  deletedAt: string | null;
  createdByUsername: string | null;
}

export interface LeaderboardEntry {
  id: string;
  name: string | null;
  lat: number;
  lng: number;
  avgOverall: number;
  ratingsCount: number;
  poopsCount: number;
}

export interface UserLeaderboardEntry {
  id: string;
  username: string;
  avatarUrl: string | null;
  totalPoints: number;
  totalPoops: number;
  distinctToilets: number;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  avatarUrl: string | null;
  createdAt: string;
  poopsCount: number;
}

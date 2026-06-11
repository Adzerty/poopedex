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
  stats: UserStats;
  newBadges: { code: string; name: string }[];
}

export interface UserStats {
  totalPoops: number;
  distinctToilets: number;
  totalRatings: number;
}

export interface Badge {
  code: string;
  name: string;
  description: string;
  icon: string | null;
  unlocked_at: string;
}

export interface Profile {
  id: string;
  username: string;
  avatarUrl: string | null;
  memberSince: string;
  stats: UserStats;
  badges: Badge[];
}

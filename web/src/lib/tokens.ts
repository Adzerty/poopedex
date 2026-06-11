/**
 * Stockage des tokens hors React (localStorage) pour que le client fetch y accède
 * sans hook. Un mini pub/sub permet à l'AuthProvider de réagir aux changements
 * (login / logout / expiration).
 */
export interface AuthUser {
  id: string;
  username: string;
}

interface Session {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const KEY = 'poopedex.session';
const listeners = new Set<() => void>();

export function getSession(): Session | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function setSession(session: Session | null): void {
  if (session) localStorage.setItem(KEY, JSON.stringify(session));
  else localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

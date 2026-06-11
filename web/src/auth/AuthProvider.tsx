import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import { getSession, setSession, subscribe, type AuthUser } from '../lib/tokens';

interface AuthState {
  user: AuthUser | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getSession()?.user ?? null);

  // Reste synchro si la session change ailleurs (refresh échoué => logout).
  useEffect(() => subscribe(() => setUser(getSession()?.user ?? null)), []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      async login(identifier, password) {
        const res = await api<AuthResponse>('/auth/login', { method: 'POST', body: { identifier, password }, auth: false });
        setSession(res);
      },
      async register(username, email, password) {
        const res = await api<AuthResponse>('/auth/register', { method: 'POST', body: { username, email, password }, auth: false });
        setSession(res);
      },
      logout() {
        setSession(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}

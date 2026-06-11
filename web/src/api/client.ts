import { getSession, setSession } from '../lib/tokens';

// Par défaut, l'API est supposée sur le même hôte que le front, port 3000.
// → marche en local (localhost) ET depuis un téléphone sur le LAN (IP du Mac),
//   sans rien configurer. Surchargeable via VITE_API_URL si l'API est ailleurs.
const BASE =
  import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:3000`;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  auth?: boolean; // attache le bearer token (défaut true)
}

async function rawFetch(path: string, accessToken: string | null, opts: ApiOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (accessToken && opts.auth !== false) headers.authorization = `Bearer ${accessToken}`;
  return fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

/** Tente un refresh une seule fois. Retourne le nouvel access token ou null. */
async function tryRefresh(): Promise<string | null> {
  const session = getSession();
  if (!session) return null;
  const res = await rawFetch('/auth/refresh', null, {
    method: 'POST',
    body: { refreshToken: session.refreshToken },
    auth: false,
  });
  if (!res.ok) {
    setSession(null); // refresh mort => déconnexion
    return null;
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string; user: typeof session.user };
  setSession(data);
  return data.accessToken;
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const session = getSession();
  let res = await rawFetch(path, session?.accessToken ?? null, opts);

  // Access expiré → un refresh + un retry.
  if (res.status === 401 && session && opts.auth !== false) {
    const fresh = await tryRefresh();
    if (fresh) res = await rawFetch(path, fresh, opts);
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError(res.status, err.error ?? 'error', err.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from './AuthProvider';

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(identifier, password);
      else await register(identifier, email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-amber-50 p-6">
      <div className="text-center">
        <div className="text-6xl">💩</div>
        <h1 className="mt-2 text-3xl font-bold text-amber-900">Poopedex</h1>
        <p className="text-sm text-amber-700">Attrape-les toutes.</p>
      </div>

      <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <input
          className="rounded-xl border border-amber-200 bg-white px-4 py-3 outline-none focus:border-amber-500"
          placeholder={mode === 'login' ? 'Pseudo ou email' : 'Pseudo'}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoCapitalize="none"
          required
        />
        {mode === 'register' && (
          <input
            className="rounded-xl border border-amber-200 bg-white px-4 py-3 outline-none focus:border-amber-500"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        )}
        <input
          className="rounded-xl border border-amber-200 bg-white px-4 py-3 outline-none focus:border-amber-500"
          placeholder="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-amber-700 px-4 py-3 font-semibold text-white active:bg-amber-800 disabled:opacity-50"
        >
          {busy ? '…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>
      </form>

      <button
        className="text-sm text-amber-700 underline"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setError(null);
        }}
      >
        {mode === 'login' ? 'Pas de compte ? Inscris-toi' : 'Déjà un compte ? Connecte-toi'}
      </button>
    </div>
  );
}

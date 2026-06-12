import { useProfile } from '../api/hooks';
import { useAuth } from '../auth/AuthProvider';

export function ProfileScreen() {
  const { logout } = useAuth();
  const { data: profile, isLoading, isError } = useProfile();

  if (isError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-amber-50 px-6 text-center">
        <p className="text-gray-600">Impossible de charger ton profil.</p>
        <button onClick={logout} className="rounded-xl bg-amber-700 px-4 py-2 font-medium text-white">
          Se reconnecter
        </button>
      </div>
    );
  }
  if (isLoading || !profile) {
    return <div className="flex h-dvh items-center justify-center text-gray-400">Chargement…</div>;
  }

  const stats = [
    { label: 'Poops', value: profile.stats.totalPoops, icon: '💩' },
    { label: 'Toilettes', value: profile.stats.distinctToilets, icon: '🚽' },
    { label: 'Notes', value: profile.stats.totalRatings, icon: '⭐' },
  ];

  return (
    <div className="min-h-dvh bg-amber-50 px-5 pb-24 pt-10">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-200 text-4xl">
          {profile.username[0]?.toUpperCase()}
        </div>
        <h1 className="text-2xl font-bold text-amber-900">{profile.username}</h1>
        <p className="text-xs text-amber-600">
          Membre depuis {new Date(profile.memberSince).toLocaleDateString('fr-FR')}
        </p>
      </div>

      <div className="mt-6 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 p-5 text-center text-white shadow-md">
        <div className="text-xs uppercase tracking-wider opacity-80">Score de rareté</div>
        <div className="mt-1 text-4xl font-extrabold">
          {profile.stats.totalPoints.toLocaleString('fr-FR')} pts
        </div>
        <div className="mt-1 text-xs opacity-80">
          Plus une toilette est inexplorée, plus elle rapporte.
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 text-center shadow-sm">
            <div className="text-2xl">{s.icon}</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-amber-900">Badges</h2>
        {profile.badges.length === 0 ? (
          <p className="text-sm text-amber-600">Aucun badge pour l'instant. Va chier quelque part ! 💪</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {profile.badges.map((b) => (
              <div key={b.code} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                <div className="text-3xl">{b.icon ?? '🏅'}</div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{b.name}</div>
                  <div className="text-xs text-gray-500">{b.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-amber-900">Amis</h2>
        <p className="rounded-2xl bg-white p-4 text-sm text-gray-400 shadow-sm">Bientôt disponible.</p>
      </section>

      <button
        onClick={logout}
        className="mt-8 w-full rounded-xl border border-amber-300 bg-white py-3 font-medium text-amber-800 active:bg-amber-100"
      >
        Se déconnecter
      </button>
    </div>
  );
}

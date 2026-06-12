import { NavLink, useLocation, useParams } from 'react-router-dom';
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useRemoveFriend,
  useSendFriendRequest,
  useUserProfile,
} from '../api/hooks';
import type { FriendshipStatus } from '../api/types';

// Vue publique d'un profil — réutilisée par l'admin pour consulter n'importe quel user.
export function UserProfileScreen() {
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const { data: profile, isLoading, isError } = useUserProfile(id ?? null);

  // Retour contextuel : depuis l'admin → liste users, sinon → classement public.
  const fromAdmin = pathname.startsWith('/admin');
  const backTo = fromAdmin ? '/admin/users' : '/leaderboard';
  const backLabel = fromAdmin ? '← Utilisateurs' : '← Classement';

  if (isLoading) {
    return <div className="flex h-dvh items-center justify-center text-gray-400">Chargement…</div>;
  }
  if (isError || !profile) {
    return (
      <div className="flex h-dvh items-center justify-center text-red-600">
        Profil introuvable.
      </div>
    );
  }

  const stats = [
    { label: 'Poops', value: profile.stats.totalPoops, icon: '💩' },
    { label: 'Toilettes', value: profile.stats.distinctToilets, icon: '🚽' },
    { label: 'Notes', value: profile.stats.totalRatings, icon: '⭐' },
  ];

  return (
    <div className="min-h-dvh bg-amber-50 px-5 pb-24 pt-6">
      <header className="mb-4">
        <NavLink to={backTo} className="text-sm text-amber-700 underline">
          {backLabel}
        </NavLink>
      </header>

      <div className="flex flex-col items-center gap-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-200 text-4xl">
          {profile.username[0]?.toUpperCase()}
        </div>
        <h1 className="text-2xl font-bold text-amber-900">{profile.username}</h1>
        {profile.isAdmin && (
          <span className="rounded bg-amber-200 px-2 text-xs font-semibold text-amber-900">
            ADMIN
          </span>
        )}
        <p className="text-xs text-amber-600">
          Membre depuis {new Date(profile.memberSince).toLocaleDateString('fr-FR')}
        </p>
        <FriendshipAction userId={profile.id} status={profile.friendshipStatus} />
      </div>

      <div className="mt-6 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 p-5 text-center text-white shadow-md">
        <div className="text-xs uppercase tracking-wider opacity-80">Score de rareté</div>
        <div className="mt-1 text-4xl font-extrabold">
          {profile.stats.totalPoints.toLocaleString('fr-FR')} pts
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
          <p className="text-sm text-amber-600">Aucun badge.</p>
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
    </div>
  );
}

function FriendshipAction({
  userId,
  status,
}: {
  userId: string;
  status: FriendshipStatus | null;
}) {
  const send = useSendFriendRequest();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const remove = useRemoveFriend();

  // Pas authentifié, ou mon propre profil → aucune action.
  if (!status || status === 'self') return null;

  const busy =
    send.isPending || accept.isPending || decline.isPending || remove.isPending;

  if (status === 'none') {
    return (
      <button
        onClick={() => send.mutate(userId)}
        disabled={busy}
        className="mt-2 rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
      >
        + Ajouter en ami
      </button>
    );
  }

  if (status === 'pending_outgoing') {
    return (
      <button
        onClick={() => remove.mutate(userId)}
        disabled={busy}
        className="mt-2 rounded-full bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
      >
        Demande envoyée — Annuler
      </button>
    );
  }

  if (status === 'pending_incoming') {
    return (
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => accept.mutate(userId)}
          disabled={busy}
          className="rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
        >
          Accepter
        </button>
        <button
          onClick={() => decline.mutate(userId)}
          disabled={busy}
          className="rounded-full bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
        >
          Refuser
        </button>
      </div>
    );
  }

  // accepted
  return (
    <button
      onClick={() => {
        if (confirm('Retirer cet ami ?')) remove.mutate(userId);
      }}
      disabled={busy}
      className="mt-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50"
    >
      ✓ Ami — retirer
    </button>
  );
}

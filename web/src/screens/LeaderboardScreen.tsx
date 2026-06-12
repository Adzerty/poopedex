import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useLeaderboard,
  useUsersLeaderboard,
  type LeaderboardScope,
} from '../api/hooks';

type Tab = 'toilets' | 'users';

export function LeaderboardScreen() {
  const [tab, setTab] = useState<Tab>('toilets');
  const [scope, setScope] = useState<LeaderboardScope>('global');

  return (
    <div className="min-h-dvh bg-amber-50 px-5 pb-24 pt-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-amber-900">🏆 Classement</h1>
        <p className="text-xs text-gray-500">
          {tab === 'toilets'
            ? 'Les toilettes les mieux notées — appuie pour voir sur la carte.'
            : scope === 'friends'
              ? 'Les plus gros chieurs parmi tes amis.'
              : 'Les 100 plus gros chieurs — classés par score de rareté cumulé.'}
        </p>
      </header>

      <div className="mb-4 flex gap-1 rounded-full bg-amber-100 p-1">
        <TabButton active={tab === 'toilets'} onClick={() => setTab('toilets')}>
          🚽 Toilettes
        </TabButton>
        <TabButton active={tab === 'users'} onClick={() => setTab('users')}>
          💩 Chieurs
        </TabButton>
      </div>

      {tab === 'users' && (
        <div className="mb-4 flex gap-1 rounded-full border border-amber-200 bg-white p-1">
          <ScopeButton active={scope === 'global'} onClick={() => setScope('global')}>
            🌍 Global
          </ScopeButton>
          <ScopeButton active={scope === 'friends'} onClick={() => setScope('friends')}>
            👥 Amis
          </ScopeButton>
        </div>
      )}

      {tab === 'toilets' ? <ToiletsList /> : <UsersList scope={scope} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
        active ? 'bg-white text-amber-900 shadow-sm' : 'text-amber-700'
      }`}
    >
      {children}
    </button>
  );
}

function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition ${
        active ? 'bg-amber-700 text-white shadow-sm' : 'text-amber-700'
      }`}
    >
      {children}
    </button>
  );
}

function ToiletsList() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useLeaderboard();

  if (isLoading) return <p className="text-gray-400">Chargement…</p>;
  if (isError) return <p className="text-red-600">Impossible de charger le classement.</p>;
  if (data && data.length === 0) {
    return <p className="text-gray-500">Aucune toilette notée pour l'instant.</p>;
  }

  return (
    <ol className="space-y-2">
      {data?.map((t, i) => (
        <li key={t.id}>
          <button
            onClick={() => navigate(`/?lat=${t.lat}&lng=${t.lng}&id=${t.id}`)}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm active:bg-amber-100"
          >
            <RankBadge rank={i + 1} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-gray-900">
                {t.name ?? 'Toilette publique'}
              </div>
              <div className="flex flex-wrap gap-x-3 text-xs text-gray-500">
                <span>⭐ {t.avgOverall.toFixed(2)}</span>
                <span>🗳️ {t.ratingsCount}</span>
                <span>💩 {t.poopsCount}</span>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ol>
  );
}

function UsersList({ scope }: { scope: LeaderboardScope }) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useUsersLeaderboard(scope);

  if (isLoading) return <p className="text-gray-400">Chargement…</p>;
  if (isError) return <p className="text-red-600">Impossible de charger le classement.</p>;
  if (data && data.length === 0) {
    return (
      <p className="text-gray-500">
        {scope === 'friends'
          ? 'Aucun ami classé. Ajoute des amis depuis leur profil.'
          : "Aucun chieur classé pour l'instant."}
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {data?.map((u, i) => (
        <li key={u.id}>
          <button
            onClick={() => navigate(`/users/${u.id}`)}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm active:bg-amber-100"
          >
            <RankBadge rank={i + 1} />
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200 text-lg font-semibold text-amber-900">
              {u.username[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-gray-900">{u.username}</div>
              <div className="flex flex-wrap gap-x-3 text-xs text-gray-500">
                <span>💩 {u.totalPoops}</span>
                <span>🚽 {u.distinctToilets}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-base font-extrabold text-amber-700">
                {u.totalPoints.toLocaleString('fr-FR')}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-amber-500">pts</div>
            </div>
          </button>
        </li>
      ))}
    </ol>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1
      ? 'bg-yellow-400 text-white'
      : rank === 2
        ? 'bg-gray-300 text-white'
        : rank === 3
          ? 'bg-amber-600 text-white'
          : 'bg-amber-100 text-amber-800';
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${cls}`}
    >
      {rank}
    </span>
  );
}

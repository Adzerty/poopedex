import { useNavigate } from 'react-router-dom';
import { useLeaderboard } from '../api/hooks';

export function LeaderboardScreen() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useLeaderboard();

  return (
    <div className="min-h-dvh bg-amber-50 px-5 pb-24 pt-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-amber-900">🏆 Top toilettes</h1>
        <p className="text-xs text-gray-500">
          Les mieux notées — appuie pour voir sur la carte.
        </p>
      </header>

      {isLoading && <p className="text-gray-400">Chargement…</p>}
      {isError && <p className="text-red-600">Impossible de charger le classement.</p>}
      {data && data.length === 0 && (
        <p className="text-gray-500">Aucune toilette notée pour l'instant.</p>
      )}

      <ol className="space-y-2">
        {data?.map((t, i) => (
          <li key={t.id}>
            <button
              onClick={() => navigate(`/?lat=${t.lat}&lng=${t.lng}&id=${t.id}`)}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm active:bg-amber-100"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  i === 0
                    ? 'bg-yellow-400 text-white'
                    : i === 1
                      ? 'bg-gray-300 text-white'
                      : i === 2
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-100 text-amber-800'
                }`}
              >
                {i + 1}
              </span>
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
    </div>
  );
}

import { NavLink, useNavigate } from 'react-router-dom';
import { useAdminToilets } from '../api/hooks';

export function AdminToiletsScreen() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useAdminToilets();

  return (
    <div className="min-h-dvh bg-amber-50 px-5 pb-24 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-amber-900">🛠️ Toilettes</h1>
        <NavLink to="/admin" className="text-sm text-amber-700 underline">
          ← Admin
        </NavLink>
      </header>

      {isLoading && <p className="text-gray-400">Chargement…</p>}
      {isError && <p className="text-red-600">Impossible de charger les toilettes.</p>}

      <ul className="space-y-2">
        {data?.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => navigate(`/?lat=${t.lat}&lng=${t.lng}&id=${t.id}`)}
              className={`flex w-full flex-col gap-1 rounded-2xl bg-white p-3 text-left shadow-sm active:bg-amber-100 ${
                t.isDeleted ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold text-gray-900">
                  {t.name ?? 'Toilette publique'}
                </span>
                <span className="shrink-0 text-xs text-gray-500">
                  {t.source === 'osm' ? 'OSM' : 'User'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                <span>💩 {t.poopsCount}</span>
                <span>⭐ {t.avgOverall !== null ? t.avgOverall.toFixed(1) : '–'}</span>
                <span>
                  {t.lat.toFixed(4)}, {t.lng.toFixed(4)}
                </span>
                {t.isDeleted && (
                  <span className="rounded bg-red-100 px-2 text-red-700">supprimée</span>
                )}
                {t.createdByUsername && <span>par {t.createdByUsername}</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

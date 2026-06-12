import { Link, NavLink } from 'react-router-dom';
import { useAdminUsers } from '../api/hooks';

export function AdminUsersScreen() {
  const { data, isLoading, isError } = useAdminUsers();

  return (
    <div className="min-h-dvh bg-amber-50 px-5 pb-24 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-amber-900">👥 Utilisateurs</h1>
        <NavLink to="/admin" className="text-sm text-amber-700 underline">
          ← Admin
        </NavLink>
      </header>

      {isLoading && <p className="text-gray-400">Chargement…</p>}
      {isError && <p className="text-red-600">Impossible de charger les utilisateurs.</p>}

      <ul className="space-y-2">
        {data?.map((u) => (
          <li key={u.id}>
            <Link
              to={`/admin/users/${u.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm active:bg-amber-100"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200 text-lg font-bold text-amber-800">
                {u.username[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-gray-900">{u.username}</span>
                  {u.isAdmin && (
                    <span className="rounded bg-amber-200 px-1.5 text-[10px] font-semibold text-amber-900">
                      ADMIN
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-gray-500">{u.email}</div>
              </div>
              <div className="shrink-0 text-xs text-gray-500">💩 {u.poopsCount}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

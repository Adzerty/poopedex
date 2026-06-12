import { Link } from 'react-router-dom';

export function AdminScreen() {
  return (
    <div className="min-h-dvh bg-amber-50 px-5 pb-24 pt-10">
      <h1 className="mb-6 text-2xl font-bold text-amber-900">🛠️ Admin</h1>
      <div className="space-y-3">
        <Link
          to="/admin/toilets"
          className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm active:bg-amber-100"
        >
          <span className="font-semibold text-gray-900">🚽 Toilettes notées</span>
          <span className="text-gray-400">›</span>
        </Link>
        <Link
          to="/admin/users"
          className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm active:bg-amber-100"
        >
          <span className="font-semibold text-gray-900">👥 Utilisateurs</span>
          <span className="text-gray-400">›</span>
        </Link>
      </div>
    </div>
  );
}

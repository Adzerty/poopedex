import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useProfile } from './api/hooks';
import { useAuth } from './auth/AuthProvider';
import { AuthScreen } from './auth/AuthScreen';
import { BottomNav } from './components/BottomNav';
import { AdminScreen } from './screens/AdminScreen';
import { AdminToiletsScreen } from './screens/AdminToiletsScreen';
import { AdminUsersScreen } from './screens/AdminUsersScreen';
import { MapScreen } from './screens/MapScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { UserProfileScreen } from './screens/UserProfileScreen';

function AdminGate({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = useProfile();
  if (isLoading) {
    return <div className="flex h-dvh items-center justify-center text-gray-400">Chargement…</div>;
  }
  if (!profile?.isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  const { user } = useAuth();
  if (!user) return <AuthScreen />;

  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="relative">
            <MapScreen />
            {/* Accès profil flottant (la carte reste plein écran). */}
            <Link
              to="/profile"
              className="absolute bottom-6 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-amber-700 text-2xl text-white shadow-lg active:bg-amber-800"
              aria-label="Profil"
            >
              👤
            </Link>
          </div>
        }
      />
      <Route
        path="/profile"
        element={
          <>
            <ProfileScreen />
            <BottomNav />
          </>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminGate>
            <>
              <AdminScreen />
              <BottomNav />
            </>
          </AdminGate>
        }
      />
      <Route
        path="/admin/toilets"
        element={
          <AdminGate>
            <AdminToiletsScreen />
          </AdminGate>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminGate>
            <AdminUsersScreen />
          </AdminGate>
        }
      />
      <Route
        path="/admin/users/:id"
        element={
          <AdminGate>
            <UserProfileScreen />
          </AdminGate>
        }
      />
    </Routes>
  );
}

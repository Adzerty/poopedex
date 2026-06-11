import { Link, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { AuthScreen } from './auth/AuthScreen';
import { BottomNav } from './components/BottomNav';
import { MapScreen } from './screens/MapScreen';
import { ProfileScreen } from './screens/ProfileScreen';

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
    </Routes>
  );
}

import { NavLink } from 'react-router-dom';
import { useProfile } from '../api/hooks';

const BASE_TABS = [
  { to: '/', label: 'Carte', icon: '🗺️' },
  { to: '/profile', label: 'Profil', icon: '👤' },
];

const ADMIN_TAB = { to: '/admin', label: 'Admin', icon: '🛠️' };

export function BottomNav() {
  const { data: profile } = useProfile();
  const tabs = profile?.isAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs ${
              isActive ? 'text-amber-700' : 'text-gray-400'
            }`
          }
        >
          <span className="text-xl">{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

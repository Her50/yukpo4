import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, List, User } from 'lucide-react';

const tabs = [
  { to: '/', label: 'Accueil', icon: Home, exact: true },
  { to: '/search', label: 'Recherche', icon: Search },
  { to: '/list', label: 'Pharmacies', icon: List },
  { to: '/compte', label: 'Compte', icon: User },
];

const PharmacieNav: React.FC = () => {
  const path = window.location.pathname;
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.exact ? path === tab.to : path.startsWith(tab.to);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
              active ? 'text-emerald-600' : 'text-gray-500'
            }`}
          >
            <Icon size={22} className="mb-0.5" />
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
};

export default PharmacieNav;

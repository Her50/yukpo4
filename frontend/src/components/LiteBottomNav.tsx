import React from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { prefix: '/pharmacies', to: '/pharmacies', label: 'Pharmacie', icon: '💊' },
  { prefix: '/livres-scolaires', to: '/livres-scolaires', label: 'Livres', icon: '📚' },
  { prefix: '/restaurant', to: '/restaurant', label: 'Restaurant', icon: '🍽️' },
];

const LiteBottomNav: React.FC = () => {
  const path = window.location.pathname;
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map(tab => {
        const active = path.startsWith(tab.prefix);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${active ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <span className="text-2xl leading-none mb-0.5">{tab.icon}</span>
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
};

export default LiteBottomNav;

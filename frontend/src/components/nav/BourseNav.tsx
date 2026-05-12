import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { BookOpen, Home, ListChecks, Truck } from 'lucide-react';

// Nav simplifiée : Accueil, Récap (commande en cours), Mes livres
// (livres publiés en troc/vente/don), Suivi (statut des commandes).
// Labels traduits via i18n.

const BourseNav: React.FC = () => {
  const { t } = useTranslation();
  const path = window.location.pathname;
  const tabs = [
    { to: '/', label: t('bourse.nav.home'), icon: Home, exact: true },
    { to: '/recap', label: t('bourse.nav.recap'), icon: ListChecks },
    { to: '/mes-livres', label: t('bourse.nav.my_books', { defaultValue: 'Mes livres' }), icon: BookOpen },
    { to: '/mes-commandes', label: t('bourse.nav.tracking'), icon: Truck },
  ];
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
              active ? 'text-amber-600' : 'text-gray-500'
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

export default BourseNav;

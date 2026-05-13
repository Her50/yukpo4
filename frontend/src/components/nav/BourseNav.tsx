import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { BookOpen, Home, LayoutDashboard, ListChecks, Truck } from 'lucide-react';

// Nav simplifiée : Accueil, Récap (commande en cours), Mes livres
// (livres publiés en troc/vente/don), Bilan (tableau de bord parent —
// solde Yukpo, crédits estimés/libérés, impact sur les commandes), Suivi
// (statut des colis et commandes en cours).
//
// 5 onglets : sur mobile (≥320 px), chaque cellule fait ≥60 px, l'icône
// reste à 22 px et le label à text-[10px] sm:text-xs reste lisible.
// Sur tablette/desktop, la nav fixe occupe toute la largeur — pas de
// changement de comportement (responsive natif via flex-1).
// Labels traduits via i18n (clé `bourse.nav.*`, 5 langues supportées).

const BourseNav: React.FC = () => {
  const { t } = useTranslation();
  const path = window.location.pathname;
  const tabs = [
    { to: '/', label: t('bourse.nav.home'), icon: Home, exact: true },
    { to: '/recap', label: t('bourse.nav.recap'), icon: ListChecks },
    { to: '/mes-livres', label: t('bourse.nav.my_books', { defaultValue: 'Mes livres' }), icon: BookOpen },
    { to: '/tableau-de-bord', label: t('bourse.nav.dashboard', { defaultValue: 'Bilan' }), icon: LayoutDashboard },
    { to: '/mes-commandes', label: t('bourse.nav.tracking'), icon: Truck },
  ];
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label={t('bourse.nav.home')}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.exact ? path === tab.to : path.startsWith(tab.to);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`flex-1 flex flex-col items-center py-2 text-[10px] sm:text-xs font-medium transition-colors min-w-0 px-1 ${
              active ? 'text-amber-600' : 'text-gray-500'
            }`}
          >
            <Icon size={22} className="mb-0.5 shrink-0" />
            <span className="truncate max-w-full">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default BourseNav;

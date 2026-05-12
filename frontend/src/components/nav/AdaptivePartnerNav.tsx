// Bottom nav adaptative — affiche les onglets adaptés au contexte (client vs partenaire).
// Sur md+, peut être affichée comme sidebar via la prop `variant="sidebar"`.
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, List, ShoppingBag, User, LayoutDashboard, ClipboardList, Package, LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { usePartnerContext } from '@/hooks/usePartnerContext';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
}

// Les clés "labelKey" pointent vers locales/{lng}.json — résolues à la volée via t().
type TabDef = { to: string; labelKey: string; icon: LucideIcon; exact?: boolean };

const PHARMA_CLIENT_TABS: TabDef[] = [
  { to: '/', labelKey: 'partnerNav.home', icon: Home, exact: true },
  { to: '/list', labelKey: 'partnerNav.pharmacies', icon: List },
  { to: '/commandes', labelKey: 'partnerNav.myOrders', icon: ShoppingBag },
  { to: '/compte', labelKey: 'partnerNav.account', icon: User },
];

const PHARMA_PARTNER_TABS: TabDef[] = [
  { to: '/dashboard', labelKey: 'partnerNav.dashboard', icon: LayoutDashboard, exact: true },
  { to: '/dashboard?tab=commandes', labelKey: 'partnerNav.orders', icon: ClipboardList },
  { to: '/dashboard?tab=produits', labelKey: 'partnerNav.products', icon: Package },
  { to: '/compte', labelKey: 'partnerNav.account', icon: User },
];

const RESTO_CLIENT_TABS: TabDef[] = [
  { to: '/', labelKey: 'partnerNav.home', icon: Home, exact: true },
  { to: '/search', labelKey: 'partnerNav.search', icon: Search },
  { to: '/commandes', labelKey: 'partnerNav.myOrders', icon: ShoppingBag },
  { to: '/compte', labelKey: 'partnerNav.account', icon: User },
];

const RESTO_PARTNER_TABS: TabDef[] = [
  { to: '/dashboard', labelKey: 'partnerNav.dashboard', icon: LayoutDashboard, exact: true },
  { to: '/dashboard?tab=menu', labelKey: 'partnerNav.menu', icon: List },
  { to: '/dashboard?tab=orders', labelKey: 'partnerNav.orders', icon: ClipboardList },
  { to: '/compte', labelKey: 'partnerNav.account', icon: User },
];

export interface AdaptivePartnerNavProps {
  pendingOrdersCount?: number;
}

const AdaptivePartnerNav: React.FC<AdaptivePartnerNavProps> = ({ pendingOrdersCount = 0 }) => {
  const { t } = useTranslation();
  const { isPartner, partnerType } = useAuth();
  const { appPartnerType, accentColor } = usePartnerContext();

  // Le partenaire est considéré "actif" sur cette app si son partner_type == celui de l'app
  const isPartnerHere = isPartner && (!appPartnerType || partnerType === appPartnerType);

  let defs: TabDef[];
  if (appPartnerType === 'restaurant') {
    defs = isPartnerHere ? RESTO_PARTNER_TABS : RESTO_CLIENT_TABS;
  } else {
    // pharmacie par défaut
    defs = isPartnerHere ? PHARMA_PARTNER_TABS : PHARMA_CLIENT_TABS;
  }

  // Résout les labels via i18n + injecte le badge sur l'onglet Commandes
  let tabs: Tab[] = defs.map((d) => ({
    to: d.to,
    label: t(d.labelKey),
    icon: d.icon,
    exact: d.exact,
  }));
  if (pendingOrdersCount > 0) {
    const ordersKeys = ['partnerNav.orders', 'partnerNav.myOrders'].map((k) => t(k));
    tabs = tabs.map((tab) => (ordersKeys.includes(tab.label) ? { ...tab, badge: pendingOrdersCount } : tab));
  }

  const activeClass =
    accentColor === 'red' ? 'text-red-600' :
    accentColor === 'emerald' ? 'text-emerald-600' :
    'text-blue-600';

  // path actif (gère ?tab=)
  const fullPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.to.includes('?')
          ? fullPath === tab.to
          : tab.exact ? path === tab.to : path.startsWith(tab.to);
        return (
          <NavLink
            key={tab.to + tab.label}
            to={tab.to}
            className={`relative flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
              active ? activeClass : 'text-gray-500'
            }`}
          >
            <Icon size={22} className="mb-0.5" />
            {tab.label}
            {tab.badge ? (
              <span className="absolute top-1 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
};

export default AdaptivePartnerNav;

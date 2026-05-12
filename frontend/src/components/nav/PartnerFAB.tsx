// FAB "Mon espace" — visible uniquement quand un partenaire connecté
// du bon partner_type visite une page publique de l'app standalone.
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { usePartnerContext } from '@/hooks/usePartnerContext';

const HIDDEN_PREFIXES = ['/dashboard', '/login', '/register', '/partenaire', '/compte'];

const PartnerFAB: React.FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { isPartner, partnerType } = useAuth();
  const { appPartnerType, accentColor } = usePartnerContext();

  // Ne s'affiche que si : partenaire connecté du bon type, et page publique
  if (!isPartner) return null;
  if (appPartnerType && partnerType && partnerType !== appPartnerType) return null;
  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null;

  const bg =
    accentColor === 'red' ? 'bg-red-600 hover:bg-red-700' :
    accentColor === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' :
    'bg-blue-600 hover:bg-blue-700';

  return (
    <Link
      to="/dashboard"
      className={`fixed right-4 bottom-20 md:bottom-6 z-40 ${bg} text-white rounded-full shadow-lg px-4 py-3 flex items-center gap-2 font-semibold transition`}
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Briefcase size={18} />
      <span className="text-sm">{t('fab.myPartnerSpace')}</span>
    </Link>
  );
};

export default PartnerFAB;

// Affichage du solde + lien rechargement, réutilisable dans toutes les apps.
// Source : `useAuth().user.credits` (déjà dérivé du JWT) + `localStorage["tokens_balance"]` mis à jour
// par les CustomEvent('tokens_updated') après débit IA.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

interface CreditBalanceProps {
  /** Affichage compact (pour header/nav) ou détaillé (pour Compte). */
  variant?: 'compact' | 'card';
  /** URL cible pour le bouton principal. Défaut : /wallet (qui contient le bouton Recharger). */
  rechargeHref?: string;
  /** Seuil bas (en unités) en dessous duquel on met en orange. */
  lowThreshold?: number;
}

const formatCredits = (n: number): string => {
  // Affiche "1.2k" au lieu de "1200" en mode compact pour éviter overflow
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toLocaleString();
};

const CreditBalance: React.FC<CreditBalanceProps> = ({
  variant = 'card',
  rechargeHref = '/wallet',
  lowThreshold = 100,
}) => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  // Solde live (réagit aux CustomEvent('tokens_updated') déclenchés après débit IA)
  const [balance, setBalance] = useState<number>(user?.credits ?? 0);

  useEffect(() => {
    setBalance(user?.credits ?? 0);
    const sync = () => {
      const stored = localStorage.getItem('tokens_balance');
      if (stored !== null) setBalance(parseInt(stored, 10));
    };
    sync();
    window.addEventListener('tokens_updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tokens_updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, [user?.credits]);

  if (!isAuthenticated) return null;

  const currency = user?.currency || 'XAF';
  const isLow = balance < lowThreshold;
  const palette = isLow
    ? 'bg-amber-50 text-amber-800 border-amber-200'
    : 'bg-gray-50 text-gray-900 border-gray-200';

  if (variant === 'compact') {
    return (
      <Link
        to={rechargeHref}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${palette} hover:bg-gray-100 transition`}
        title={t('balance.rechargeTooltip')}
      >
        <Coins size={13} />
        <span>{formatCredits(balance)}</span>
        <Plus size={11} className="opacity-60" />
      </Link>
    );
  }

  // variant === 'card'
  return (
    <div className={`rounded-lg border p-4 ${palette}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs uppercase tracking-wide font-semibold opacity-80">
          {t('balance.title')}
        </div>
        {isLow && (
          <span className="text-[10px] font-bold uppercase">{t('balance.low')}</span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-bold">
            {balance.toLocaleString()} <span className="text-sm font-medium opacity-60">{currency}</span>
          </div>
          <div className="text-[11px] opacity-70 mt-0.5">{t('balance.subtitle')}</div>
        </div>
        <Link
          to={rechargeHref}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-gray-300 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition"
        >
          <Plus size={14} /> {t('balance.recharge')}
        </Link>
      </div>
    </div>
  );
};

export default CreditBalance;

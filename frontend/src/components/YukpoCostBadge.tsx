// Badge de coût Yukpo + alerte solde insuffisant.
// À monter à côté des actions qui consomment des crédits (analyse fichier, IA chat, etc.).
//
// Stratégie :
// - Coût estimé heuristique côté front (table fixe par action) — pas d'appel backend supplémentaire.
// - Si user.credits >= cost → badge gris "≈ X crédits" (info passive).
// - Si user.credits < cost → bandeau ambre + bouton "Recharger" qui dirige vers /wallet.
import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

/** Estimation de coût en crédits Yukpo (= XAF) par type d'action. */
export const YUKPO_COST_ESTIMATE: Record<string, number> = {
  column_detection: 5,         // Détection colonnes import (1 appel /ai/chat avec headers)
  ordonnance_extract: 30,      // Vision IA — analyse ordonnance
  drug_interactions: 10,       // IA interactions médicaments
  drug_dosage: 8,              // IA suggestion posologie
  service_creation: 50,        // Création service par IA
  besoin_search: 15,           // Recherche besoin par IA
  chat_message: 10,            // Message chat Yukpo standard
  whisper_transcription: 20,   // Transcription audio
  vision_image: 25,            // Analyse image
};

interface YukpoCostBadgeProps {
  /** Type d'action (clé dans YUKPO_COST_ESTIMATE). */
  action: keyof typeof YUKPO_COST_ESTIMATE | string;
  /** Coût en dur si on veut surcharger l'estimation. */
  costOverride?: number;
  /** Variant compact (inline) ou banner (avec CTA recharge si bloqué). */
  variant?: 'inline' | 'banner';
  /** className optionnelle. */
  className?: string;
}

const YukpoCostBadge: React.FC<YukpoCostBadgeProps> = ({
  action,
  costOverride,
  variant = 'inline',
  className = '',
}) => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  const cost = costOverride ?? YUKPO_COST_ESTIMATE[action] ?? 10;
  const balance = user?.credits ?? 0;
  const insufficient = balance < cost;

  if (variant === 'inline') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          insufficient ? 'bg-amber-100 text-amber-800' : 'bg-indigo-50 text-indigo-700'
        } ${className}`}
        title={insufficient ? t('cost.insufficientTooltip') : t('cost.estimatedTooltip')}
      >
        <Sparkles size={10} />
        ≈ {cost} {t('common.xaf')}
      </span>
    );
  }

  // variant === 'banner'
  if (insufficient) {
    return (
      <div className={`p-3 rounded-lg bg-amber-50 border border-amber-300 text-sm ${className}`}>
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-amber-900">{t('cost.insufficientTitle')}</div>
            <div className="text-xs text-amber-800 mt-0.5">
              {t('cost.insufficientMsg', { cost, balance })}
            </div>
          </div>
          <Link
            to="/recharge"
            className="shrink-0 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
          >
            {t('balance.recharge')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-xs flex items-center gap-1.5 ${className}`}>
      <Sparkles size={12} className="text-indigo-600" />
      <span className="text-indigo-800">{t('cost.estimatedBanner', { cost })}</span>
    </div>
  );
};

export default YukpoCostBadge;

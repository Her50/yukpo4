// Bandeau "Interactions personnelles" (Phase B1, 2026-05-15).
//
// Croise la liste de médicaments en cours (matchs RFQ ou ordonnance scannée)
// avec le carnet santé du patient connecté (medication_history 90 derniers
// jours) via POST /api/users/me/check-interactions.
//
// N'apparaît que si :
//   - utilisateur connecté (sinon pas de carnet)
//   - au moins 1 médicament fourni
//   - sévérité retournée != "none"
//
// Sévérités possibles : none / mild / moderate / major / contraindicated.
// Affiche un encart coloré + suggestions d'alternatives si l'IA en propose.

import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { apiPost } from '@/services/apiService';

interface InteractionResult {
  severity: 'none' | 'mild' | 'moderate' | 'major' | 'contraindicated' | string;
  description: string;
  recommendation: string;
  alternative_suggestions: Array<{ original: string; alternative: string; reason?: string }>;
  context_size: number;
  context_medications?: string[];
}

interface Props {
  medications: string[];
  /** Nombre de jours d'historique à scanner (90 par défaut côté backend). */
  days?: number;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  mild:            { bg: 'bg-blue-50',    border: 'border-blue-300',    text: 'text-blue-900',    icon: 'text-blue-600' },
  moderate:        { bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-900',   icon: 'text-amber-600' },
  major:           { bg: 'bg-orange-100', border: 'border-orange-400',  text: 'text-orange-900',  icon: 'text-orange-700' },
  contraindicated: { bg: 'bg-red-100',    border: 'border-red-400',     text: 'text-red-900',     icon: 'text-red-700' },
};

const PersonalInteractionsBanner: React.FC<Props> = ({ medications, days }) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InteractionResult | null>(null);

  const meds = medications.map(m => m.trim()).filter(Boolean);
  const medsKey = meds.join('||').toLowerCase();

  useEffect(() => {
    if (!isAuthenticated || meds.length === 0) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiPost('/api/users/me/check-interactions', {
      new_medications: meds,
      days: days ?? 90,
    })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (cancelled || !j) return;
        setResult({
          severity: j.severity || 'none',
          description: j.description || '',
          recommendation: j.recommendation || '',
          alternative_suggestions: Array.isArray(j.alternative_suggestions) ? j.alternative_suggestions : [],
          context_size: j.context_size || 0,
          context_medications: j.context_medications,
        });
      })
      .catch(() => { if (!cancelled) setResult(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, medsKey, days]);

  if (!isAuthenticated || meds.length === 0) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 inline-flex items-center gap-2 w-full">
        <Loader2 size={16} className="animate-spin text-gray-500" />
        <span className="text-xs text-gray-600">{t('pharmacie.interactions.checking')}</span>
      </div>
    );
  }

  if (!result || result.severity === 'none' || result.context_size === 0) return null;

  const style = SEVERITY_STYLES[result.severity] || SEVERITY_STYLES.moderate;
  const isHigh = result.severity === 'major' || result.severity === 'contraindicated';

  return (
    <div className={`rounded-2xl border-2 ${style.border} ${style.bg} px-4 py-3`}>
      <div className="flex items-start gap-2.5">
        {isHigh ? (
          <ShieldAlert className={`w-5 h-5 ${style.icon} shrink-0 mt-0.5`} />
        ) : (
          <AlertTriangle className={`w-5 h-5 ${style.icon} shrink-0 mt-0.5`} />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-wide ${style.text}`}>
            {t(`pharmacie.interactions.severity.${result.severity}`, {
              defaultValue: result.severity,
            })}
            {' · '}
            <span className="font-normal normal-case opacity-80">
              {t('pharmacie.interactions.contextLabel', { count: result.context_size })}
            </span>
          </p>
          {result.description && (
            <p className={`text-xs ${style.text} mt-1 leading-snug`}>{result.description}</p>
          )}
          {result.recommendation && (
            <p className={`text-xs ${style.text} mt-1 leading-snug font-semibold`}>
              💡 {result.recommendation}
            </p>
          )}
          {result.alternative_suggestions.length > 0 && (
            <ul className={`text-xs ${style.text} mt-2 space-y-0.5`}>
              {result.alternative_suggestions.slice(0, 3).map((a, i) => (
                <li key={i}>
                  <strong>{a.original}</strong> → {a.alternative}
                  {a.reason && <span className="opacity-80"> ({a.reason})</span>}
                </li>
              ))}
            </ul>
          )}
          <p className={`text-[10px] ${style.text} opacity-70 mt-2 italic`}>
            {t('pharmacie.interactions.disclaimer')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PersonalInteractionsBanner;

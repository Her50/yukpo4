// Fiche médicament — bottom-sheet plein-écran qui charge en parallèle :
//   • POST /api/pharmacies/ai/dosage         → posologie, précautions, warnings, requires_prescription
//   • POST /api/pharmacies/ai/alternatives   → génériques équivalents
// Ouverte après scan d'une boîte de médicament ou clic sur un médicament
// dans la liste. Chaque section a son propre state de loading/erreur.
//
// ⚠️ Cadre éthique/réglementaire :
//   - Bandeau "Information indicative" sticky en haut (toujours visible)
//   - Si l'IA classifie le médicament comme "à prescription", on masque la
//     posologie chiffrée et on affiche une orientation vers le pharmacien
//   - CTA "Contacter un pharmacien" en footer obligatoire

import {
  AlertTriangle,
  ChevronRight,
  Info,
  Loader2,
  Lock,
  MapPin,
  Phone,
  Pill,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiPost } from '@/services/apiService';
import { useHistoryBackClose } from '@/hooks/useHistoryBackClose';

interface DosageData {
  dosage: string;
  frequency: string;
  duration: string;
  precautions: string[];
  warnings: string[];
  requires_prescription: boolean;
}

interface AlternativeData {
  name: string;
  dci?: string;
  reason: string;
  similarity_score: number;
}

interface Props {
  medicationName: string;
  onClose: () => void;
  /** Callback déclenché par le CTA "Trouver des pharmacies qui ont ce médicament". */
  onFindPharmacies?: (medication: string) => void;
}

const MedicationDetailSheet: React.FC<Props> = ({ medicationName, onClose, onFindPharmacies }) => {
  const { t } = useTranslation();

  // Bouton Retour navigateur ferme la fiche au lieu de quitter la PWA.
  useHistoryBackClose(true, onClose);

  const [dosage, setDosage] = useState<DosageData | null>(null);
  const [dosageLoading, setDosageLoading] = useState(true);
  const [dosageError, setDosageError] = useState(false);

  const [alternatives, setAlternatives] = useState<AlternativeData[]>([]);
  const [altLoading, setAltLoading] = useState(true);
  const [altError, setAltError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiPost('/api/pharmacies/ai/dosage', {
          medication_name: medicationName,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.success) {
          setDosage({
            dosage: data.dosage || '',
            frequency: data.frequency || '',
            duration: data.duration || '',
            precautions: Array.isArray(data.precautions) ? data.precautions : [],
            warnings: Array.isArray(data.warnings) ? data.warnings : [],
            requires_prescription: Boolean(data.requires_prescription),
          });
        } else {
          setDosageError(true);
        }
      } catch {
        if (!cancelled) setDosageError(true);
      } finally {
        if (!cancelled) setDosageLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await apiPost('/api/pharmacies/ai/alternatives', {
          medication_name: medicationName,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.success && Array.isArray(data.alternatives)) {
          setAlternatives(data.alternatives);
        } else {
          setAltError(true);
        }
      } catch {
        if (!cancelled) setAltError(true);
      } finally {
        if (!cancelled) setAltLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [medicationName]);

  const isPrescription = dosage?.requires_prescription === true;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col pb-[env(safe-area-inset-bottom)] animate-slide-up-sheet"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-3 pb-3 border-b border-gray-100">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Pill className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t('pharmacie.detail.title')}</p>
              <h2 className="text-base font-bold text-gray-900 leading-tight truncate">{medicationName}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 active:bg-gray-200 flex items-center justify-center"
              aria-label="close"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Disclaimer permanent — STICKY juste sous le header, toujours visible */}
        <div className="px-5 pt-3 pb-2 bg-white border-b border-amber-100 sticky top-0 z-10">
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-snug font-medium">
              {t('pharmacie.disclaimer.long')}
            </p>
          </div>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Médicament à prescription : on masque les détails chiffrés */}
          {isPrescription && !dosageLoading && (
            <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-red-900">
                    {t('pharmacie.disclaimer.prescriptionOnly')}
                  </p>
                  <p className="text-xs text-red-800 mt-1 leading-snug">
                    {t('pharmacie.disclaimer.prescriptionDescription')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section Posologie — masquée si à prescription */}
          {!isPrescription && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                {t('pharmacie.detail.dosage')}
              </h3>
              {dosageLoading ? (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('pharmacie.detail.loading')}
                </div>
              ) : dosageError || !dosage ? (
                <p className="text-sm text-gray-500">{t('pharmacie.detail.errorDosage')}</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <FieldCell label={t('pharmacie.detail.dosage')} value={dosage.dosage} />
                    <FieldCell label={t('pharmacie.detail.frequency')} value={dosage.frequency} />
                    <FieldCell label={t('pharmacie.detail.duration')} value={dosage.duration} />
                  </div>
                  {dosage.precautions.length > 0 && (
                    <BulletList
                      title={t('pharmacie.detail.precautions')}
                      icon={<ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />}
                      items={dosage.precautions}
                      tone="emerald"
                    />
                  )}
                  {dosage.warnings.length > 0 && (
                    <BulletList
                      title={t('pharmacie.detail.warnings')}
                      icon={<AlertTriangle className="w-3.5 h-3.5 text-red-600" />}
                      items={dosage.warnings}
                      tone="red"
                    />
                  )}
                  {/* Rappel ciblé enfants/âgés */}
                  <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-900 leading-snug">
                      {t('pharmacie.disclaimer.ageGroupWarning')}
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Section Alternatives — affichée même pour les médicaments à prescription
              (le pharmacien décide, mais l'utilisateur peut savoir qu'il y a un générique) */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              {t('pharmacie.detail.alternatives')}
            </h3>
            {altLoading ? (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('pharmacie.detail.loading')}
              </div>
            ) : altError ? (
              <p className="text-sm text-gray-500">{t('pharmacie.detail.errorAlternatives')}</p>
            ) : alternatives.length === 0 ? (
              <p className="text-sm text-gray-500">{t('pharmacie.detail.noAlternatives')}</p>
            ) : (
              <div className="space-y-2">
                {alternatives.map((alt, i) => (
                  <div
                    key={`${alt.name}-${i}`}
                    className="rounded-xl border border-gray-100 px-3 py-2.5 bg-white"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{alt.name}</p>
                      <span className="text-xs text-indigo-600 font-medium shrink-0">
                        {Math.round(alt.similarity_score * 100)}%
                      </span>
                    </div>
                    {alt.dci && <p className="text-xs text-gray-500 mt-0.5">DCI : {alt.dci}</p>}
                    {alt.reason && <p className="text-xs text-gray-600 mt-1 leading-snug">{alt.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer CTA — toujours afficher au moins le bouton pharmacien */}
        <div className="px-5 pt-3 pb-4 border-t border-gray-100 space-y-2">
          {onFindPharmacies && (
            <button
              onClick={() => {
                onFindPharmacies(medicationName);
                onClose();
              }}
              className="w-full bg-blue-600 active:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              {t('pharmacie.detail.findPharmacies')}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              if (onFindPharmacies) onFindPharmacies(medicationName);
              onClose();
            }}
            className="w-full border-2 border-emerald-600 text-emerald-700 py-2.5 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2"
          >
            <Phone className="w-4 h-4" />
            {t('pharmacie.disclaimer.contactPharmacist')}
          </button>
        </div>
      </div>
    </div>
  );
};

const FieldCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-gray-50 px-2.5 py-2 text-center">
    <p className="text-[10px] uppercase text-gray-500 leading-none mb-1 tracking-wide">{label}</p>
    <p className="text-xs font-semibold text-gray-800 leading-tight">{value || '—'}</p>
  </div>
);

const BulletList: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: string[];
  tone: 'emerald' | 'red';
}> = ({ title, icon, items, tone }) => {
  const toneCls =
    tone === 'red'
      ? 'bg-red-50 border-red-100 text-red-900'
      : 'bg-emerald-50 border-emerald-100 text-emerald-900';
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneCls}`}>
      <p className="text-xs font-semibold mb-1 inline-flex items-center gap-1">
        {icon}
        {title}
      </p>
      <ul className="text-xs space-y-0.5 list-disc list-inside leading-snug">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
};

export default MedicationDetailSheet;

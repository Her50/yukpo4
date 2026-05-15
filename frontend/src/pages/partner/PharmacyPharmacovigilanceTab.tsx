// Tab Pharmacovigilance dashboard pharmacien : signaler un effet indésirable
// ou un problème médicament observé chez un patient.
//
// Workflow :
//   1. Liste des signalements précédents (read)
//   2. Bouton "Nouveau signalement" → formulaire complet
//   3. Submit → POST /api/pharmacies/me/pharmacovigilance
//
// Données patient anonymisées : seulement tranche d'âge + genre. Pas de nom.
// Sévérité contrainte : minor / moderate / serious / life_threatening.

import { AlertTriangle, Calendar, ChevronDown, ChevronUp, FileText, Loader2, Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '@/services/apiService';
import { useToast } from '@/hooks/use-toast';

interface Report {
  id: number;
  pharmacy_id: number | null;
  pharmacy_name: string | null;
  medication_name: string;
  medication_dosage: string | null;
  medication_batch: string | null;
  patient_age_range: string | null;
  patient_gender: string | null;
  side_effects: string;
  severity: 'minor' | 'moderate' | 'serious' | 'life_threatening';
  onset_date: string | null;
  reported_to_authority: boolean;
  authority_reference: string | null;
  notes: string | null;
  created_at: string;
}

const SEVERITY_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  minor: { label: 'severityMinor', bg: 'bg-blue-100', text: 'text-blue-800' },
  moderate: { label: 'severityModerate', bg: 'bg-amber-100', text: 'text-amber-800' },
  serious: { label: 'severitySerious', bg: 'bg-orange-200', text: 'text-orange-900' },
  life_threatening: { label: 'severityLifeThreatening', bg: 'bg-red-200', text: 'text-red-900' },
};

const PharmacyPharmacovigilanceTab: React.FC<{ pharmacyId: number | null }> = ({ pharmacyId }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/pharmacies/me/pharmacovigilance?days=180');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setReports(Array.isArray(json?.reports) ? json.reports : []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-800 inline-flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          {t('pharmacie.pharmacovigilance.title')}
        </h2>
        <button
          onClick={() => setFormOpen(true)}
          disabled={!pharmacyId}
          className="bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-red-300 text-white px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('pharmacie.pharmacovigilance.cta')}
        </button>
      </div>

      <p className="text-[11px] text-gray-500 italic leading-snug">
        {t('pharmacie.pharmacovigilance.anonymousNotice')}
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-red-500" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">{t('pharmacie.pharmacovigilance.listEmpty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <ReportCard
              key={r.id}
              report={r}
              expanded={expanded === r.id}
              onToggle={() => setExpanded(prev => (prev === r.id ? null : r.id))}
            />
          ))}
        </div>
      )}

      {formOpen && pharmacyId && (
        <PharmacovigilanceFormSheet
          pharmacyId={pharmacyId}
          onClose={() => setFormOpen(false)}
          onSubmitted={() => {
            setFormOpen(false);
            toast({ title: t('pharmacie.pharmacovigilance.submitOk') });
            load();
          }}
        />
      )}
    </div>
  );
};

const ReportCard: React.FC<{
  report: Report;
  expanded: boolean;
  onToggle: () => void;
}> = ({ report, expanded, onToggle }) => {
  const { t } = useTranslation();
  const sev = SEVERITY_STYLES[report.severity] || SEVERITY_STYLES.moderate;
  const dateStr = (() => {
    try {
      return new Date(report.created_at).toLocaleDateString();
    } catch {
      return report.created_at;
    }
  })();
  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {report.medication_name}
            {report.medication_dosage && (
              <span className="text-gray-500 font-normal"> · {report.medication_dosage}</span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sev.bg} ${sev.text}`}>
              {t(`pharmacie.pharmacovigilance.${sev.label}`)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {dateStr}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2 text-xs">
          <p className="text-gray-800">{report.side_effects}</p>
          {(report.medication_batch || report.medication_dosage) && (
            <p className="text-gray-500">
              {report.medication_batch && <span>Lot : {report.medication_batch}</span>}
            </p>
          )}
          {(report.patient_age_range || report.patient_gender) && (
            <p className="text-gray-500">
              Patient : {report.patient_age_range || '—'} ·{' '}
              {report.patient_gender || '—'}
            </p>
          )}
          {report.reported_to_authority && report.authority_reference && (
            <p className="text-emerald-700 font-semibold">
              ✓ Signalé aux autorités · Réf : {report.authority_reference}
            </p>
          )}
          {report.notes && <p className="text-gray-600 italic">{report.notes}</p>}
        </div>
      )}
    </div>
  );
};

const PharmacovigilanceFormSheet: React.FC<{
  pharmacyId: number;
  onClose: () => void;
  onSubmitted: () => void;
}> = ({ pharmacyId, onClose, onSubmitted }) => {
  const { t } = useTranslation();
  const [medication, setMedication] = useState('');
  const [dosage, setDosage] = useState('');
  const [batch, setBatch] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [ageRange, setAgeRange] = useState('19-40');
  const [gender, setGender] = useState('unknown');
  const [effects, setEffects] = useState('');
  const [severity, setSeverity] = useState<'minor' | 'moderate' | 'serious' | 'life_threatening'>(
    'moderate',
  );
  const [onsetDate, setOnsetDate] = useState('');
  const [reported, setReported] = useState(false);
  const [authorityRef, setAuthorityRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = medication.trim().length > 0 && effects.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await apiPost('/api/pharmacies/me/pharmacovigilance', {
        pharmacy_id: pharmacyId,
        medication_name: medication.trim(),
        medication_dosage: dosage.trim() || undefined,
        medication_batch: batch.trim() || undefined,
        medication_manufacturer: manufacturer.trim() || undefined,
        patient_age_range: ageRange,
        patient_gender: gender,
        side_effects: effects.trim(),
        severity,
        onset_date: onsetDate || undefined,
        reported_to_authority: reported,
        authority_reference: reported ? authorityRef.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onSubmitted();
    } catch {
      /* erreur loguée par apiPost */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-3 pb-3 border-b border-gray-100">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2 sm:hidden" />
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 inline-flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              {t('pharmacie.pharmacovigilance.cta')}
            </h3>
            <button onClick={onClose} className="text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <Field label={t('pharmacie.pharmacovigilance.labelMedication')} required>
            <input
              type="text"
              value={medication}
              onChange={e => setMedication(e.target.value)}
              className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label={t('pharmacie.pharmacovigilance.labelDosage')}>
              <input
                type="text"
                value={dosage}
                onChange={e => setDosage(e.target.value)}
                placeholder="500mg"
                className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </Field>
            <Field label={t('pharmacie.pharmacovigilance.labelBatch')}>
              <input
                type="text"
                value={batch}
                onChange={e => setBatch(e.target.value)}
                className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </Field>
          </div>

          <Field label={t('pharmacie.pharmacovigilance.labelManufacturer')}>
            <input
              type="text"
              value={manufacturer}
              onChange={e => setManufacturer(e.target.value)}
              className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label={t('pharmacie.pharmacovigilance.labelAgeRange')}>
              <select
                value={ageRange}
                onChange={e => setAgeRange(e.target.value)}
                className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="0-12">{t('pharmacie.pharmacovigilance.ageRange012')}</option>
                <option value="13-18">{t('pharmacie.pharmacovigilance.ageRange1318')}</option>
                <option value="19-40">{t('pharmacie.pharmacovigilance.ageRange1940')}</option>
                <option value="41-60">{t('pharmacie.pharmacovigilance.ageRange4160')}</option>
                <option value="60+">{t('pharmacie.pharmacovigilance.ageRange60plus')}</option>
              </select>
            </Field>
            <Field label={t('pharmacie.pharmacovigilance.labelGender')}>
              <select
                value={gender}
                onChange={e => setGender(e.target.value)}
                className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="M">{t('pharmacie.pharmacovigilance.genderM')}</option>
                <option value="F">{t('pharmacie.pharmacovigilance.genderF')}</option>
                <option value="other">{t('pharmacie.pharmacovigilance.genderOther')}</option>
                <option value="unknown">{t('pharmacie.pharmacovigilance.genderUnknown')}</option>
              </select>
            </Field>
          </div>

          <Field label={t('pharmacie.pharmacovigilance.labelSideEffects')} required>
            <textarea
              value={effects}
              onChange={e => setEffects(e.target.value)}
              rows={3}
              className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </Field>

          <Field label={t('pharmacie.pharmacovigilance.labelSeverity')} required>
            <select
              value={severity}
              onChange={e => setSeverity(e.target.value as any)}
              className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="minor">{t('pharmacie.pharmacovigilance.severityMinor')}</option>
              <option value="moderate">{t('pharmacie.pharmacovigilance.severityModerate')}</option>
              <option value="serious">{t('pharmacie.pharmacovigilance.severitySerious')}</option>
              <option value="life_threatening">
                {t('pharmacie.pharmacovigilance.severityLifeThreatening')}
              </option>
            </select>
          </Field>

          <Field label={t('pharmacie.pharmacovigilance.labelOnsetDate')}>
            <input
              type="date"
              value={onsetDate}
              onChange={e => setOnsetDate(e.target.value)}
              className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={reported}
              onChange={e => setReported(e.target.checked)}
              className="w-4 h-4 accent-red-600"
            />
            <span>{t('pharmacie.pharmacovigilance.labelAuthorityReported')}</span>
          </label>

          {reported && (
            <Field label={t('pharmacie.pharmacovigilance.labelAuthorityReference')}>
              <input
                type="text"
                value={authorityRef}
                onChange={e => setAuthorityRef(e.target.value)}
                className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </Field>
          )}

          <Field label={t('pharmacie.pharmacovigilance.labelNotes')}>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </Field>
        </div>

        <div className="px-5 pt-3 pb-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700"
          >
            {t('pharmacie.pharmacovigilance.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white disabled:bg-red-300 inline-flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {submitting
              ? t('pharmacie.pharmacovigilance.submitting')
              : t('pharmacie.pharmacovigilance.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  required,
  children,
}) => (
  <label className="block">
    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </p>
    {children}
  </label>
);

export default PharmacyPharmacovigilanceTab;

// Phase C1 (2026-05-15) — Allergies & contre-indications déclarées par le patient.
//
// Le patient déclare une fois pour toutes ses allergies (pénicilline, AINS,
// sulfamides…) et conditions (grossesse, allaitement, G6PD, asthme…). À chaque
// alerte RFQ vue par un pharmacien, le backend croise et remonte un drapeau
// rouge dans le tableau des alertes. Le pharmacien peut refuser ou proposer
// une alternative avant de dispenser.
//
// Sécurité juridique : c'est une auto-déclaration patient, pas un diagnostic.

import {
  AlertTriangle, ArrowLeft, Heart, Loader2, Plus, ShieldAlert, Trash2, X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '@/services/apiService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Allergy {
  id: number;
  kind: 'allergy' | 'condition' | 'intolerance';
  label: string;
  note?: string | null;
  severity: 'mild' | 'moderate' | 'severe';
  updated_at: string;
}

// Liste des labels reconnus côté backend (cf. allergy_label_to_families).
// Ces clés doivent rester EXACTEMENT alignées avec le backend pour que le
// matching fonctionne. On affiche un libellé localisé via i18n.
const ALLERGY_LABELS: Array<{ key: string; tKey: string }> = [
  { key: 'penicilline', tKey: 'pharmacie.allergies.labels.penicilline' },
  { key: 'cephalosporines', tKey: 'pharmacie.allergies.labels.cephalosporines' },
  { key: 'sulfamides', tKey: 'pharmacie.allergies.labels.sulfamides' },
  { key: 'ains', tKey: 'pharmacie.allergies.labels.ains' },
  { key: 'aspirine', tKey: 'pharmacie.allergies.labels.aspirine' },
  { key: 'codeine', tKey: 'pharmacie.allergies.labels.codeine' },
  { key: 'iode', tKey: 'pharmacie.allergies.labels.iode' },
  { key: 'tetracyclines', tKey: 'pharmacie.allergies.labels.tetracyclines' },
  { key: 'quinolones', tKey: 'pharmacie.allergies.labels.quinolones' },
];

const CONDITION_LABELS: Array<{ key: string; tKey: string }> = [
  { key: 'grossesse', tKey: 'pharmacie.allergies.labels.grossesse' },
  { key: 'allaitement', tKey: 'pharmacie.allergies.labels.allaitement' },
  { key: 'g6pd', tKey: 'pharmacie.allergies.labels.g6pd' },
  { key: 'asthme', tKey: 'pharmacie.allergies.labels.asthme' },
  { key: 'insuffisance_renale', tKey: 'pharmacie.allergies.labels.insuffisance_renale' },
  { key: 'insuffisance_hepatique', tKey: 'pharmacie.allergies.labels.insuffisance_hepatique' },
];

const SEVERITY_COLORS: Record<string, string> = {
  severe: 'bg-red-100 text-red-700 border-red-300',
  moderate: 'bg-amber-100 text-amber-700 border-amber-300',
  mild: 'bg-yellow-100 text-yellow-700 border-yellow-300',
};

const AllergiesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const [items, setItems] = useState<Allergy[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formKind, setFormKind] = useState<'allergy' | 'condition' | 'intolerance'>('allergy');
  const [formLabel, setFormLabel] = useState('');
  const [formCustomLabel, setFormCustomLabel] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formSeverity, setFormSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet('/api/users/me/allergies');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setItems(Array.isArray(j?.allergies) ? j.allergies : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) load();
  }, [isLoading, isAuthenticated, load]);

  const resetForm = () => {
    setFormKind('allergy');
    setFormLabel('');
    setFormCustomLabel('');
    setFormNote('');
    setFormSeverity('moderate');
  };

  const handleSubmit = async () => {
    const label = (formLabel === 'other' ? formCustomLabel.trim().toLowerCase() : formLabel) || '';
    if (!label) {
      toast({ title: t('pharmacie.allergies.labelRequired'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const r = await apiPost('/api/users/me/allergies', {
        kind: formKind,
        label,
        note: formNote.trim() || null,
        severity: formSeverity,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast({ title: t('pharmacie.allergies.saved') });
      setSheetOpen(false);
      resetForm();
      await load();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('pharmacie.allergies.confirmDelete'))) return;
    try {
      const r = await apiDelete(`/api/users/me/allergies/${id}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setItems(prev => prev.filter(x => x.id !== id));
      toast({ title: t('pharmacie.allergies.deleted') });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  const grouped = useMemo(() => {
    const a = items.filter(x => x.kind === 'allergy');
    const c = items.filter(x => x.kind === 'condition');
    const i = items.filter(x => x.kind === 'intolerance');
    return { allergies: a, conditions: c, intolerances: i };
  }, [items]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <div className="bg-white rounded-2xl p-6 max-w-md text-center shadow">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h2 className="font-bold text-gray-800">{t('pharmacie.allergies.loginRequired')}</h2>
          <button
            onClick={() => navigate('/login?redirect=/allergies')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-semibold"
          >
            {t('common.login')}
          </button>
        </div>
      </div>
    );
  }

  const optionsForKind = formKind === 'condition' ? CONDITION_LABELS : ALLERGY_LABELS;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-5 shadow">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/health-record')}
            className="inline-flex items-center gap-1.5 text-red-100 text-xs mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('common.back')}
          </button>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6" />
            <h1 className="text-xl font-bold">{t('pharmacie.allergies.title')}</h1>
          </div>
          <p className="text-xs text-red-100 mt-1 leading-snug">
            {t('pharmacie.allergies.subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* Disclaimer permanent */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 mb-4">
          <p className="font-semibold mb-0.5">{t('pharmacie.allergies.disclaimer.title')}</p>
          <p className="leading-snug">{t('pharmacie.allergies.disclaimer.body')}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
            <Heart className="w-10 h-10 text-red-300 mx-auto mb-2" />
            <p className="text-sm text-gray-700 font-semibold">
              {t('pharmacie.allergies.empty.title')}
            </p>
            <p className="text-xs text-gray-500 mt-1">{t('pharmacie.allergies.empty.body')}</p>
            <button
              onClick={() => setSheetOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm rounded-xl font-semibold hover:bg-red-700"
            >
              <Plus className="w-4 h-4" />
              {t('pharmacie.allergies.declare')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {(['allergies', 'conditions', 'intolerances'] as const).map(group => {
              const list = grouped[group];
              if (list.length === 0) return null;
              return (
                <div key={group}>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    {t(`pharmacie.allergies.groups.${group}`)}
                  </h3>
                  <div className="space-y-2">
                    {list.map(a => (
                      <div
                        key={a.id}
                        className={`rounded-xl border p-3 flex items-start gap-3 ${
                          SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.moderate
                        }`}
                      >
                        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">
                            {t(`pharmacie.allergies.labels.${a.label}`, a.label)}
                          </p>
                          {a.note && (
                            <p className="text-xs mt-0.5 opacity-80">{a.note}</p>
                          )}
                          <p className="text-[10px] mt-1 opacity-60">
                            {t(`pharmacie.allergies.severity.${a.severity}`)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="p-1.5 hover:bg-white/40 rounded-lg shrink-0"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB ajout */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg flex items-center justify-center"
        aria-label={t('pharmacie.allergies.declare')}
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Sheet création */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex sm:items-center items-end justify-center"
          onClick={() => !submitting && setSheetOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-bold text-gray-800">{t('pharmacie.allergies.declare')}</h3>
              <button onClick={() => setSheetOpen(false)} aria-label={t('common.close')}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Type */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  {t('pharmacie.allergies.kind')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['allergy', 'condition', 'intolerance'] as const).map(k => (
                    <button
                      key={k}
                      onClick={() => {
                        setFormKind(k);
                        setFormLabel('');
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                        formKind === k
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      {t(`pharmacie.allergies.kinds.${k}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Label */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  {t('pharmacie.allergies.label')}
                </label>
                <select
                  value={formLabel}
                  onChange={e => setFormLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                >
                  <option value="">{t('pharmacie.allergies.choose')}</option>
                  {optionsForKind.map(o => (
                    <option key={o.key} value={o.key}>
                      {t(o.tKey, o.key)}
                    </option>
                  ))}
                  <option value="other">{t('pharmacie.allergies.other')}</option>
                </select>
                {formLabel === 'other' && (
                  <input
                    type="text"
                    value={formCustomLabel}
                    onChange={e => setFormCustomLabel(e.target.value)}
                    placeholder={t('pharmacie.allergies.otherPlaceholder')}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                  />
                )}
              </div>

              {/* Sévérité */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  {t('pharmacie.allergies.severityLabel')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['mild', 'moderate', 'severe'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setFormSeverity(s)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                        formSeverity === s
                          ? s === 'severe'
                            ? 'bg-red-600 text-white border-red-600'
                            : s === 'moderate'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-yellow-400 text-gray-800 border-yellow-400'
                          : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      {t(`pharmacie.allergies.severity.${s}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  {t('pharmacie.allergies.note')} ({t('common.optional')})
                </label>
                <textarea
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  placeholder={t('pharmacie.allergies.notePlaceholder')}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t bg-gray-50 flex gap-2">
              <button
                onClick={() => setSheetOpen(false)}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllergiesPage;

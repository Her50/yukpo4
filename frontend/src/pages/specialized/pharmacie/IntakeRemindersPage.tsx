// Phase B2.2 (2026-05-15) — Rappels de prise de médicament.
//
// Le patient configure des rappels (heures précises HH:MM en local time)
// pour ses médicaments. Le backend worker scan toutes les minutes et envoie
// une push à l'heure dite.
//
// CRUD complet :
//   - Liste des rappels actifs / inactifs
//   - Création (nom, heures, posologie, end_at optionnel)
//   - Suppression
//
// Mobile-first PWA : max-w-2xl, sheets bottom sur mobile.

import {
  AlertTriangle, ArrowLeft, Bell, Calendar, Clock, Loader2, Plus, RefreshCw, Trash2, X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '@/services/apiService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Reminder {
  id: number;
  medication_name: string;
  posology?: string | null;
  times_of_day: string[];
  end_at?: string | null;
  timezone: string;
  is_active: boolean;
  last_sent_at?: string | null;
  created_at: string;
  // C4 — renouvellement chronique automatique
  auto_refill?: boolean;
  refill_interval_days?: number;
  refill_lead_days?: number;
  next_refill_at?: string | null;
  last_refill_alert_id?: number | null;
}

const QUICK_PRESETS: Array<{ label: string; times: string[] }> = [
  { label: '2x/jour (matin + soir)', times: ['08:00', '20:00'] },
  { label: '3x/jour (matin + midi + soir)', times: ['08:00', '13:00', '20:00'] },
  { label: '4x/jour (toutes les 6h)', times: ['06:00', '12:00', '18:00', '00:00'] },
];

const IntakeRemindersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [params] = useSearchParams();

  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  // Pré-rempli si la page est ouverte depuis un autre écran avec ?med=…
  const initialMed = params.get('med') || '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet('/api/users/me/intake-reminders');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setItems(Array.isArray(j?.reminders) ? j.reminders : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) load();
  }, [isLoading, isAuthenticated, load]);

  useEffect(() => {
    // Si l'URL contient ?med=X, on ouvre directement le sheet de création.
    if (initialMed) setCreating(true);
  }, [initialMed]);

  const handleDelete = async (id: number) => {
    if (!confirm(t('pharmacie.reminders.confirmDelete'))) return;
    try {
      const r = await apiDelete(`/api/users/me/intake-reminders/${id}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setItems(prev => prev.filter(x => x.id !== id));
      toast({ title: t('pharmacie.reminders.deleted') });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  const activeItems = useMemo(() => items.filter(x => x.is_active), [items]);
  const inactiveItems = useMemo(() => items.filter(x => !x.is_active), [items]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <div className="bg-white rounded-2xl p-6 max-w-md text-center shadow">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h2 className="font-bold text-gray-800">{t('pharmacie.reminders.loginRequired')}</h2>
          <button
            onClick={() => navigate('/login?redirect=/reminders')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-semibold"
          >
            {t('common.login')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-5 shadow">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-blue-100 text-xs mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t('common.back')}
          </button>
          <h1 className="text-xl font-bold inline-flex items-center gap-2">
            <Bell className="w-5 h-5" /> {t('pharmacie.reminders.title')}
          </h1>
          <p className="text-blue-100 text-xs mt-1">{t('pharmacie.reminders.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <button
          onClick={() => setCreating(true)}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center justify-center gap-2"
        >
          <Plus size={18} /> {t('pharmacie.reminders.add')}
        </button>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500">
            <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm">{t('pharmacie.reminders.empty')}</p>
          </div>
        ) : (
          <>
            {activeItems.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {t('pharmacie.reminders.active', { count: activeItems.length })}
                </h2>
                <ul className="space-y-2">
                  {activeItems.map(r => (
                    <ReminderCard key={r.id} reminder={r} onDelete={() => handleDelete(r.id)} onRefresh={load} />
                  ))}
                </ul>
              </section>
            )}
            {inactiveItems.length > 0 && (
              <section className="mt-4 opacity-70">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {t('pharmacie.reminders.ended', { count: inactiveItems.length })}
                </h2>
                <ul className="space-y-2">
                  {inactiveItems.map(r => (
                    <ReminderCard key={r.id} reminder={r} onDelete={() => handleDelete(r.id)} onRefresh={load} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <p className="text-[11px] text-gray-500 text-center leading-snug italic">
          {t('pharmacie.reminders.disclaimer')}
        </p>
      </div>

      {creating && (
        <CreateReminderSheet
          initialMed={initialMed}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
            toast({ title: t('pharmacie.reminders.created') });
          }}
        />
      )}
    </div>
  );
};

const ReminderCard: React.FC<{
  reminder: Reminder;
  onDelete: () => void;
  onRefresh: () => void;
}> = ({ reminder, onDelete, onRefresh }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [interval, setInterval] = useState(reminder.refill_interval_days ?? 28);

  const toggleAutoRefill = async (enable: boolean) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/users/me/intake-reminders/${reminder.id}/auto-refill`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          enabled: enable,
          interval_days: interval,
          lead_days: reminder.refill_lead_days ?? 3,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast({
        title: enable
          ? t('pharmacie.reminders.refill.enabled')
          : t('pharmacie.reminders.refill.disabled'),
      });
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const nextRefillLabel = useMemo(() => {
    if (!reminder.auto_refill || !reminder.next_refill_at) return null;
    try {
      const d = new Date(reminder.next_refill_at);
      const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
      if (days <= 0) return t('pharmacie.reminders.refill.dueNow');
      return t('pharmacie.reminders.refill.nextIn', { days });
    } catch {
      return null;
    }
  }, [reminder.auto_refill, reminder.next_refill_at, t]);

  return (
    <li className="bg-white rounded-xl shadow-sm p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{reminder.medication_name}</p>
          {reminder.posology && (
            <p className="text-xs text-gray-500 mt-0.5">{reminder.posology}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {reminder.times_of_day.map(time => (
              <span
                key={time}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-semibold tabular-nums"
              >
                <Clock size={10} /> {time}
              </span>
            ))}
          </div>
          {reminder.end_at && (
            <p className="text-[10px] text-gray-400 mt-1 inline-flex items-center gap-1">
              <Calendar size={10} /> {t('pharmacie.reminders.until', { date: reminder.end_at })}
            </p>
          )}

          {/* C4 — Renouvellement chronique automatique */}
          {reminder.is_active && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setShowConfig(v => !v)}
                  className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-900"
                >
                  <RefreshCw
                    size={12}
                    className={reminder.auto_refill ? 'text-emerald-600' : 'text-gray-400'}
                  />
                  <span className="font-semibold">
                    {t('pharmacie.reminders.refill.label')}
                  </span>
                  {reminder.auto_refill ? (
                    <span className="text-emerald-700 text-[10px]">
                      ✓ {t('pharmacie.reminders.refill.activeBadge', {
                        days: reminder.refill_interval_days ?? 28,
                      })}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-[10px]">
                      {t('pharmacie.reminders.refill.disabledBadge')}
                    </span>
                  )}
                </button>
                <button
                  disabled={busy}
                  onClick={() => toggleAutoRefill(!reminder.auto_refill)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                    reminder.auto_refill ? 'bg-emerald-600' : 'bg-gray-300'
                  }`}
                  aria-label={t('pharmacie.reminders.refill.label')}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
                      reminder.auto_refill ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {nextRefillLabel && (
                <p className="text-[10px] text-emerald-700 mt-1">{nextRefillLabel}</p>
              )}
              {showConfig && reminder.auto_refill && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-[11px] text-gray-600">
                    {t('pharmacie.reminders.refill.intervalLabel')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={interval}
                    onChange={e => setInterval(Math.max(1, parseInt(e.target.value) || 28))}
                    className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-xs"
                  />
                  <span className="text-[11px] text-gray-500">
                    {t('pharmacie.reminders.refill.days')}
                  </span>
                  <button
                    onClick={() => toggleAutoRefill(true)}
                    disabled={busy}
                    className="ml-auto px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-semibold disabled:opacity-50"
                  >
                    {t('common.save')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-600 p-1 shrink-0"
          aria-label="Supprimer"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
};

const CreateReminderSheet: React.FC<{
  initialMed: string;
  onClose: () => void;
  onCreated: () => void;
}> = ({ initialMed, onClose, onCreated }) => {
  const { t } = useTranslation();
  const [med, setMed] = useState(initialMed);
  const [posology, setPosology] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00', '20:00']);
  const [endAt, setEndAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTime = () => setTimes(prev => [...prev, '12:00']);
  const updateTime = (idx: number, v: string) =>
    setTimes(prev => prev.map((t, i) => (i === idx ? v : t)));
  const removeTime = (idx: number) => setTimes(prev => prev.filter((_, i) => i !== idx));

  const applyPreset = (preset: typeof QUICK_PRESETS[number]) => {
    setTimes([...preset.times]);
  };

  const handleSubmit = async () => {
    if (!med.trim() || times.length === 0) {
      setError(t('pharmacie.reminders.errMissing'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await apiPost('/api/users/me/intake-reminders', {
        medication_name: med.trim(),
        posology: posology.trim() || undefined,
        times_of_day: times,
        end_at: endAt || undefined,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onCreated();
    } catch (e: any) {
      setError(e?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">{t('pharmacie.reminders.newTitle')}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-700">
              {t('pharmacie.reminders.medName')}
            </label>
            <input
              type="text"
              value={med}
              onChange={e => setMed(e.target.value)}
              placeholder="Ex : Doliprane 500mg"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700">
              {t('pharmacie.reminders.posology')}
            </label>
            <input
              type="text"
              value={posology}
              onChange={e => setPosology(e.target.value)}
              placeholder="Ex : 1 comprimé après le repas"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Préréglages rapides */}
          <div>
            <label className="text-xs font-semibold text-gray-700">
              {t('pharmacie.reminders.presets')}
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {QUICK_PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700">
              {t('pharmacie.reminders.times')}
            </label>
            <div className="space-y-1.5 mt-1">
              {times.map((tm, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={tm}
                    onChange={e => updateTime(idx, e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-gray-300 tabular-nums text-sm"
                  />
                  {times.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTime(idx)}
                      className="text-gray-400 hover:text-red-600 p-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addTime}
                className="text-xs text-blue-600 font-semibold inline-flex items-center gap-1"
              >
                <Plus size={12} /> {t('pharmacie.reminders.addTime')}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700">
              {t('pharmacie.reminders.endAt')}
              <span className="text-gray-400 font-normal"> ({t('pharmacie.reminders.optional')})</span>
            </label>
            <input
              type="date"
              value={endAt}
              onChange={e => setEndAt(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {t('pharmacie.reminders.create')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntakeRemindersPage;

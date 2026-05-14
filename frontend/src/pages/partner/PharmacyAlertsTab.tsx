// Tab "Alertes" du dashboard pharmacien partenaire.
//
// Workflow RFQ : un utilisateur a émis une demande de disponibilité de
// médicaments. Si la pharmacie est dans le rayon, l'alerte apparaît ici.
// Le pharmacien coche les médicaments disponibles, indique éventuellement
// le prix et propose des alternatives, puis soumet.
//
// L'utilisateur voit alors la pharmacie classée par son taux de complétude
// (5/5 > 3/5 > 1/5) dans son interface.
//
// Polling : 10s. Pas de WebSocket pour ce MVP — quand un worker push WhatsApp
// sera en place, on pourra réduire le polling à un trigger sur réception.

import { AlertCircle, Check, ChevronDown, ChevronUp, Clock, Loader2, MapPin, Plus, Sparkles, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '@/services/apiService';

interface QueryItem {
  name: string;
  quantity?: number;
  dosage?: string;
}

interface IncomingAlert {
  alert_id: number;
  pharmacy_id: number;
  query_items: QueryItem[];
  total_items: number;
  distance_km: number;
  radius_km: number;
  expires_at: string;
  already_responded: boolean;
}

interface ItemStatusInput {
  name: string;
  available: boolean;
  price?: number;
  note?: string;
}

interface AlternativeInput {
  original: string;
  alt: string;
  note?: string;
}

const POLL_INTERVAL_MS = 10_000;

const PharmacyAlertsTab: React.FC = () => {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<IncomingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await apiGet('/api/pharmacies/me/alerts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAlerts(Array.isArray(data?.alerts) ? data.alerts : []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const handle = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [load]);

  const pendingAlerts = useMemo(() => alerts.filter(a => !a.already_responded), [alerts]);
  const respondedAlerts = useMemo(() => alerts.filter(a => a.already_responded), [alerts]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800 inline-flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          Demandes en attente
          {pendingAlerts.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
              {pendingAlerts.length}
            </span>
          )}
        </h2>
        {refreshing && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : pendingAlerts.length === 0 && respondedAlerts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">Aucune demande en cours dans votre zone.</p>
          <p className="text-xs text-gray-400 mt-1">
            Cette liste se met à jour automatiquement toutes les 10 secondes.
          </p>
        </div>
      ) : (
        <>
          {pendingAlerts.length > 0 && (
            <div className="space-y-3">
              {pendingAlerts.map(a => (
                <AlertCard key={a.alert_id} alert={a} onSubmitted={() => load(true)} />
              ))}
            </div>
          )}

          {respondedAlerts.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Déjà répondues ({respondedAlerts.length})
              </h3>
              <div className="space-y-2 opacity-75">
                {respondedAlerts.map(a => (
                  <AlertCard
                    key={a.alert_id}
                    alert={a}
                    onSubmitted={() => load(true)}
                    collapsed
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ============================================================================

const AlertCard: React.FC<{
  alert: IncomingAlert;
  onSubmitted: () => void;
  collapsed?: boolean;
}> = ({ alert, onSubmitted, collapsed = false }) => {
  const [expanded, setExpanded] = useState(!collapsed);
  const [items, setItems] = useState<ItemStatusInput[]>(() =>
    alert.query_items.map(q => ({ name: q.name, available: false })),
  );
  const [alternatives, setAlternatives] = useState<AlternativeInput[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const remainingSeconds = useMemo(() => {
    const exp = new Date(alert.expires_at).getTime();
    return Math.max(0, Math.floor((exp - Date.now()) / 1000));
  }, [alert.expires_at]);

  const [countdown, setCountdown] = useState(remainingSeconds);
  useEffect(() => {
    setCountdown(remainingSeconds);
    if (remainingSeconds <= 0) return;
    const handle = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(handle);
  }, [remainingSeconds]);

  const toggleItem = (idx: number) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, available: !it.available } : it)));
  };

  const setItemPrice = (idx: number, price: string) => {
    const p = parseFloat(price);
    setItems(prev =>
      prev.map((it, i) => (i === idx ? { ...it, price: isNaN(p) ? undefined : p } : it)),
    );
  };

  const addAlternative = (original: string) => {
    setAlternatives(prev => [...prev, { original, alt: '' }]);
  };

  const updateAlternative = (idx: number, alt: string) => {
    setAlternatives(prev => prev.map((a, i) => (i === idx ? { ...a, alt } : a)));
  };

  const removeAlternative = (idx: number) => {
    setAlternatives(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiPost(`/api/medication-alerts/${alert.alert_id}/respond`, {
        pharmacy_id: alert.pharmacy_id,
        items_status: items,
        alternatives: alternatives.filter(a => a.alt.trim().length > 0),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitOk(true);
      setTimeout(onSubmitted, 1500);
    } catch (e: any) {
      setSubmitError(e?.message || 'Erreur soumission');
    } finally {
      setSubmitting(false);
    }
  };

  const availableCount = items.filter(i => i.available).length;
  const isExpired = countdown <= 0;

  return (
    <div
      className={`rounded-2xl border ${
        alert.already_responded
          ? 'border-emerald-200 bg-emerald-50/30'
          : isExpired
            ? 'border-gray-200 bg-gray-50'
            : 'border-amber-200 bg-amber-50/40'
      } overflow-hidden`}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <p className="font-semibold text-gray-900 text-sm">
              Demande #{alert.alert_id} — {alert.total_items} médicament(s)
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {alert.distance_km.toFixed(1)} km
            </span>
            <span className={`inline-flex items-center gap-1 font-semibold ${
              isExpired ? 'text-red-500' : countdown < 60 ? 'text-orange-600' : 'text-gray-600'
            }`}>
              <Clock className="w-3 h-3" />
              {isExpired ? 'Expirée' : `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`}
            </span>
            {alert.already_responded && (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <Check className="w-3 h-3" />
                Répondue
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-white p-4 space-y-3">
          {/* Liste des médicaments demandés avec checkbox + prix */}
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div
                key={idx}
                className={`rounded-xl border p-3 ${
                  it.available
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={it.available}
                      onChange={() => toggleItem(idx)}
                      disabled={alert.already_responded || isExpired}
                      className="w-5 h-5 accent-emerald-600"
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{it.name}</p>
                    {alert.query_items[idx]?.dosage && (
                      <p className="text-xs text-gray-500">{alert.query_items[idx].dosage}</p>
                    )}
                  </div>
                  {it.available && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="Prix"
                        value={it.price || ''}
                        onChange={e => setItemPrice(idx, e.target.value)}
                        disabled={alert.already_responded || isExpired}
                        className="w-20 px-2 py-1 text-xs border border-gray-200 rounded text-right"
                      />
                      <span className="text-xs text-gray-500">FCFA</span>
                    </div>
                  )}
                </div>

                {/* Bouton "Alternative" pour les médicaments NON disponibles */}
                {!it.available && !alert.already_responded && !isExpired && (
                  <button
                    onClick={() => addAlternative(it.name)}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Proposer une alternative
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Alternatives (n'entrent pas dans le score de complétude) */}
          {alternatives.length > 0 && (
            <div className="border-t border-dashed border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Alternatives proposées
                <span className="ml-1 normal-case text-[10px] font-normal text-gray-400">
                  (n'entrent pas dans le taux de complétude)
                </span>
              </p>
              <div className="space-y-2">
                {alternatives.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="shrink-0 text-gray-500 line-through">{a.original}</span>
                    <span className="text-gray-400">→</span>
                    <input
                      type="text"
                      value={a.alt}
                      onChange={e => updateAlternative(idx, e.target.value)}
                      placeholder="Nom de l'alternative"
                      className="flex-1 px-2 py-1 border border-gray-200 rounded"
                    />
                    <button
                      onClick={() => removeAlternative(idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!alert.already_responded && !isExpired && (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-gray-500">
                {availableCount}/{alert.total_items} disponible(s)
              </span>
              <div className="flex-1" />
              <button
                onClick={handleSubmit}
                disabled={submitting || submitOk}
                className={`px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 ${
                  submitOk
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white disabled:bg-blue-400'
                }`}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : submitOk ? (
                  <>
                    <Check className="w-4 h-4" />
                    Envoyée
                  </>
                ) : (
                  'Soumettre disponibilité'
                )}
              </button>
            </div>
          )}

          {submitError && (
            <div className="text-xs text-red-600 inline-flex items-center gap-1">
              <X className="w-3 h-3" />
              {submitError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PharmacyAlertsTab;

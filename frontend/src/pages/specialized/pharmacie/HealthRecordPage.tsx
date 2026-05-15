// Carnet de santé numérique du patient.
//
// Affiche l'historique de toutes les demandes de médicaments (alertes RFQ)
// émises par le patient connecté, avec pour chacune la meilleure pharmacie
// qui a répondu (items, prix, alternatives, contacts).
//
// Permet aussi le réordre 1 clic : recommander les mêmes médicaments depuis
// la position GPS courante.
//
// Mobile-first PWA : max-w-2xl, cards full-width, breakpoints responsive.

import { AlertCircle, ArrowLeft, Calendar, ChevronDown, ChevronUp, Clock, Loader2, MapPin, Phone, Pill, RotateCcw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '@/services/apiService';
import { useGpsWithFallback } from '@/hooks/useGpsWithFallback';
import { useToast } from '@/hooks/use-toast';

interface QueryItem {
  name: string;
  quantity?: number;
  dosage?: string;
}

interface ItemStatus {
  name: string;
  available: boolean;
  price?: number;
}

interface BestMatch {
  pharmacy_id: number;
  pharmacy_name: string;
  pharmacy_ville?: string;
  pharmacy_quartier?: string;
  pharmacy_telephone?: string;
  pharmacy_whatsapp?: string;
  found_count: number;
  items_status: ItemStatus[];
  alternatives?: { original: string; alt: string }[];
  responded_at: string;
}

interface HistoryEntry {
  alert_id: number;
  query_items: QueryItem[];
  total_items: number;
  created_at: string;
  expires_at: string;
  status: string;
  notified_pharmacies_count: number;
  total_responses: number;
  best_match: BestMatch | null;
}

const PERIODS: { days: number; key: string }[] = [
  { days: 7, key: 'days7' },
  { days: 30, key: 'days30' },
  { days: 90, key: 'days90' },
  { days: 180, key: 'days180' },
  { days: 365, key: 'days365' },
];

const HealthRecordPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { gps, detect: detectGps } = useGpsWithFallback();

  const [days, setDays] = useState(90);
  const [data, setData] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reordering, setReordering] = useState<number | null>(null);

  const load = useCallback(
    async (period: number) => {
      setLoading(true);
      try {
        const res = await apiGet(`/api/users/me/medication-history?days=${period}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(Array.isArray(json?.history) ? json.history : []);
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(days);
  }, [days, load]);

  const handleReorder = async (entry: HistoryEntry) => {
    if (!gps) {
      detectGps();
      toast({
        title: 'Position GPS requise',
        description: 'Activez votre position pour recommander cette ordonnance.',
        variant: 'destructive',
      });
      return;
    }
    setReordering(entry.alert_id);
    try {
      const res = await apiPost(`/api/medication-alerts/${entry.alert_id}/reorder`, {
        gps_lat: gps.lat,
        gps_lng: gps.lng,
        radius_km: 20,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      toast({ title: t('pharmacie.record.reorderDone') });
      navigate(`/alerts/${json.alert_id}`);
    } catch (e: any) {
      toast({
        title: 'Impossible de recommander',
        description: e?.message,
        variant: 'destructive',
      });
    } finally {
      setReordering(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-500">
      {/* Hero header — mobile-first compact */}
      <div className="px-5 pt-6 pb-5 text-white max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-blue-100 text-xs mb-3 active:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('pharmacie.record.backHome')}
        </button>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold leading-tight">{t('pharmacie.record.title')}</h1>
            <p className="text-xs text-blue-100 mt-0.5">{t('pharmacie.record.subtitle')}</p>
          </div>
        </div>

        {/* Sélecteur période — chips scroll horizontal mobile */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                days === p.days
                  ? 'bg-white text-blue-700'
                  : 'bg-white/15 text-white border border-white/30'
              }`}
            >
              {t(`pharmacie.record.${p.key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="bg-white rounded-t-3xl min-h-screen pb-28">
        <div className="max-w-2xl mx-auto px-4 py-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Pill className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm">{t('pharmacie.record.empty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map(entry => (
                <HistoryCard
                  key={entry.alert_id}
                  entry={entry}
                  expanded={expandedId === entry.alert_id}
                  reordering={reordering === entry.alert_id}
                  onToggle={() =>
                    setExpandedId(prev => (prev === entry.alert_id ? null : entry.alert_id))
                  }
                  onReorder={() => handleReorder(entry)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const HistoryCard: React.FC<{
  entry: HistoryEntry;
  expanded: boolean;
  reordering: boolean;
  onToggle: () => void;
  onReorder: () => void;
}> = ({ entry, expanded, reordering, onToggle, onReorder }) => {
  const { t } = useTranslation();
  const dateStr = useMemo(() => {
    try {
      return new Date(entry.created_at).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return entry.created_at;
    }
  }, [entry.created_at]);

  const isFullMatch =
    entry.best_match && entry.best_match.found_count === entry.total_items;
  const itemsLabel = entry.query_items
    .slice(0, 2)
    .map(q => q.name)
    .join(', ');
  const moreCount = entry.query_items.length - 2;

  const statusKey =
    entry.status === 'open'
      ? 'statusOpen'
      : entry.status === 'closed' || entry.status === 'expired'
        ? 'statusClosed'
        : 'statusClosed';

  return (
    <div
      className={`rounded-2xl border ${
        isFullMatch ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100 bg-white'
      } overflow-hidden`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
            {itemsLabel}
            {moreCount > 0 && (
              <span className="text-gray-500 font-normal"> + {moreCount}</span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {dateStr}
            </span>
            <span className="inline-flex items-center gap-1">
              <Pill className="w-3 h-3" />
              {entry.total_items}
            </span>
            {entry.best_match && (
              <span
                className={`inline-flex items-center gap-1 font-semibold ${
                  isFullMatch ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {entry.best_match.found_count}/{entry.total_items}
              </span>
            )}
            {!entry.best_match && entry.status !== 'open' && (
              <span className="inline-flex items-center gap-1 text-red-600">
                <AlertCircle className="w-3 h-3" />
                {t('pharmacie.record.notResolved')}
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
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* Liste médicaments demandés */}
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {t('pharmacie.record.recordTitle')}
            </p>
            <ul className="text-xs space-y-0.5">
              {entry.query_items.map((q, i) => {
                const itemStatus = entry.best_match?.items_status.find(
                  s => s.name.trim().toLowerCase() === q.name.trim().toLowerCase(),
                );
                return (
                  <li key={`${q.name}-${i}`} className="flex items-center gap-2">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                        itemStatus?.available
                          ? 'bg-emerald-500'
                          : itemStatus
                            ? 'bg-red-400'
                            : 'bg-gray-300'
                      }`}
                    />
                    <span
                      className={`flex-1 ${
                        itemStatus && !itemStatus.available
                          ? 'text-gray-400 line-through'
                          : 'text-gray-800'
                      }`}
                    >
                      {q.name}
                      {q.dosage && <span className="text-gray-500"> · {q.dosage}</span>}
                    </span>
                    {itemStatus?.available && typeof itemStatus.price === 'number' && (
                      <span className="text-blue-700 font-semibold shrink-0">
                        {itemStatus.price.toLocaleString()} FCFA
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Meilleure pharmacie */}
          {entry.best_match && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {t('pharmacie.record.bestPharmacy')}
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {entry.best_match.pharmacy_name}
              </p>
              {(entry.best_match.pharmacy_quartier || entry.best_match.pharmacy_ville) && (
                <p className="text-xs text-gray-500 mt-0.5">
                  <MapPin className="w-3 h-3 inline mr-0.5" />
                  {[entry.best_match.pharmacy_quartier, entry.best_match.pharmacy_ville]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {entry.best_match.pharmacy_telephone && (
                  <a
                    href={`tel:${entry.best_match.pharmacy_telephone}`}
                    className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold"
                  >
                    <Phone className="w-3 h-3" />
                    {entry.best_match.pharmacy_telephone}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Bouton réordre 1 clic */}
          <button
            onClick={onReorder}
            disabled={reordering}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white py-2.5 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2"
          >
            {reordering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            {reordering
              ? t('pharmacie.record.reorderingBtn')
              : t('pharmacie.record.reorderBtn')}
          </button>
        </div>
      )}
    </div>
  );
};

export default HealthRecordPage;

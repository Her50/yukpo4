// Page admin Yukpo : Radar de rupture nationale (Phase B1, 2026-05-15).
//
// Agrégation des médicaments signalés UNAVAILABLE par les pharmaciens dans
// pharmacy_responses sur N jours, regroupés par nom du médicament, avec
// nombre de pharmacies impactées et villes touchées.
//
// Accès : role='admin' ou 'super_admin' (vérifié côté backend, on filtre
// aussi côté UI pour éviter l'appel inutile).

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, AlertTriangle, ArrowLeft, Filter, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { apiGet } from '@/services/apiService';
import { useAuth } from '@/contexts/AuthContext';

interface RuptureItem {
  medication: string;
  unavailable_count: number;
  pharmacies_affected: number;
  cities_affected: number;
  cities: string[];
}

const PERIODS: Array<{ days: number; labelKey: string }> = [
  { days: 1,  labelKey: 'pharmacie.adminRupture.period.1d' },
  { days: 7,  labelKey: 'pharmacie.adminRupture.period.7d' },
  { days: 30, labelKey: 'pharmacie.adminRupture.period.30d' },
  { days: 90, labelKey: 'pharmacie.adminRupture.period.90d' },
];

const AdminRuptureRadarPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [items, setItems] = useState<RuptureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(7);
  const [city, setCity] = useState('');
  const [threshold, setThreshold] = useState(3);

  const load = useCallback(async () => {
    if (!isAdmin) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        days: String(period),
        threshold: String(threshold),
      });
      if (city.trim()) params.set('city', city.trim().toLowerCase());
      const r = await apiGet(`/api/admin/pharmacie/rupture-radar?${params.toString()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setItems(Array.isArray(j?.radar) ? j.radar : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, period, city, threshold]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <div className="bg-white rounded-2xl p-6 max-w-md text-center shadow">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h2 className="font-bold text-gray-800">{t('pharmacie.adminRupture.forbidden')}</h2>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-semibold"
          >
            {t('pharmacie.adminRupture.back')}
          </button>
        </div>
      </div>
    );
  }

  const maxCount = items[0]?.unavailable_count || 1;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-rose-700 to-red-600 text-white px-4 py-5 shadow">
        <div className="max-w-screen-md mx-auto flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-rose-100 text-xs mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {t('pharmacie.adminRupture.back')}
            </button>
            <h1 className="text-lg font-bold">{t('pharmacie.adminRupture.title')}</h1>
            <p className="text-rose-100 text-xs">{t('pharmacie.adminRupture.subtitle')}</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30"
            aria-label="Rafraîchir"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-screen-md mx-auto px-4 py-4 space-y-4">
        {/* Filtres */}
        <div className="bg-white rounded-xl shadow-sm p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <Filter size={14} /> {t('pharmacie.adminRupture.filters')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map(p => (
              <button
                key={p.days}
                onClick={() => setPeriod(p.days)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  period === p.days
                    ? 'bg-rose-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              onBlur={load}
              onKeyDown={e => e.key === 'Enter' && load()}
              placeholder={t('pharmacie.adminRupture.cityPlaceholder')}
              className="p-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            <input
              type="number"
              min={1}
              max={100}
              value={threshold}
              onChange={e => setThreshold(Math.max(1, Number(e.target.value) || 1))}
              onBlur={load}
              className="p-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              title={t('pharmacie.adminRupture.thresholdHelp')}
            />
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-rose-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500">
            <Activity size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">{t('pharmacie.adminRupture.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it, i) => {
              const widthPct = Math.round((it.unavailable_count / maxCount) * 100);
              return (
                <li key={it.medication + i} className="bg-white rounded-xl shadow-sm p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm capitalize truncate">
                        {it.medication}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {t('pharmacie.adminRupture.unavailableCount', { count: it.unavailable_count })}
                        {' · '}
                        {t('pharmacie.adminRupture.pharmaciesAffected', { count: it.pharmacies_affected })}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-semibold shrink-0">
                      #{i + 1}
                    </span>
                  </div>
                  {/* Barre de visualisation */}
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  {it.cities.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <MapPin size={12} className="text-gray-400 mt-0.5" />
                      {it.cities.slice(0, 5).map(c => (
                        <span key={c} className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full capitalize">
                          {c}
                        </span>
                      ))}
                      {it.cities.length > 5 && (
                        <span className="text-[10px] text-gray-500">+{it.cities.length - 5}</span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-[10px] text-gray-400 text-center italic">
          {t('pharmacie.adminRupture.footer')}
        </p>
      </div>
    </div>
  );
};

export default AdminRuptureRadarPage;

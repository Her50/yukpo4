// Tab "Analytics" du dashboard pharmacien.
//
// Affiche les métriques clés sur 7 / 30 / 90 jours :
//   - Taux de réponse aux alertes (reçues vs validées) + temps moyen
//   - Notifications manquées (alertes non validées dans le délai 5 min)
//   - Top médicaments demandés
//   - Ruptures de stock : médicaments demandés mais cochés indisponibles
//   - Top hôpitaux prescripteurs (depuis archives scannées)
//   - Top médecins prescripteurs (depuis archives scannées)
//
// Endpoint : GET /api/pharmacies/me/analytics?days=N

import { AlertTriangle, Building2, ClipboardList, Clock, Loader2, Package, Stethoscope, TrendingUp } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/services/apiService';

interface RankedItem {
  name: string;
  count: number;
}

interface AnalyticsData {
  days: number;
  empty?: boolean;
  response_rate: {
    received: number;
    responded: number;
    missed: number;
    rate: number;
    avg_response_minutes: number | null;
  };
  top_requested: RankedItem[];
  top_unavailable: RankedItem[];
  top_hospitals: RankedItem[];
  top_doctors: RankedItem[];
  archives_count: number;
}

const PERIODS: { value: number; label: string }[] = [
  { value: 7, label: '7 jours' },
  { value: 30, label: '30 jours' },
  { value: 90, label: '90 jours' },
];

const PharmacyAnalyticsTab: React.FC = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (period: number) => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/pharmacies/me/analytics?days=${period}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-800 inline-flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          Analytics
        </h2>
        <div className="flex gap-1 bg-gray-100 rounded-full p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                days === p.value
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : !data || data.empty ? (
        <div className="text-center py-10 text-gray-500">
          <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">Aucune donnée pour cette période.</p>
          <p className="text-xs text-gray-400 mt-1">
            Les statistiques apparaîtront dès que vous recevrez et validerez des alertes.
          </p>
        </div>
      ) : (
        <>
          {/* === KPIs principaux === */}
          <div className="grid grid-cols-2 gap-2">
            <KpiCard
              icon={<ClipboardList className="w-4 h-4 text-blue-600" />}
              label="Alertes reçues"
              value={data.response_rate.received.toString()}
            />
            <KpiCard
              icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
              label="Taux de réponse"
              value={`${Math.round(data.response_rate.rate * 100)}%`}
              tone={data.response_rate.rate >= 0.7 ? 'success' : data.response_rate.rate >= 0.4 ? 'warning' : 'danger'}
            />
            <KpiCard
              icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
              label="Manquées"
              value={data.response_rate.missed.toString()}
              tone={data.response_rate.missed > 5 ? 'danger' : data.response_rate.missed > 0 ? 'warning' : 'default'}
            />
            <KpiCard
              icon={<Clock className="w-4 h-4 text-indigo-600" />}
              label="Temps moyen"
              value={
                data.response_rate.avg_response_minutes !== null
                  ? `${data.response_rate.avg_response_minutes.toFixed(1)} min`
                  : '—'
              }
            />
          </div>

          {/* === Top médicaments demandés === */}
          <RankedSection
            title="Médicaments les plus demandés"
            icon={<Package className="w-4 h-4 text-blue-600" />}
            items={data.top_requested}
            emptyText="Aucun médicament demandé sur la période."
            barColor="bg-blue-500"
          />

          {/* === Ruptures de stock (alertes indispo) === */}
          <RankedSection
            title="Ruptures fréquentes (réapprovisionnement conseillé)"
            icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
            items={data.top_unavailable}
            emptyText="Aucune rupture détectée — vous avez tout ce qu'on vous demande."
            barColor="bg-red-500"
            hint="Médicaments que vous avez cochés indisponibles dans vos réponses. Indice fort de demande non satisfaite."
          />

          {/* === Top hôpitaux === */}
          <RankedSection
            title="Hôpitaux / cliniques prescripteurs"
            icon={<Building2 className="w-4 h-4 text-indigo-600" />}
            items={data.top_hospitals}
            emptyText="Aucune ordonnance archivée avec hôpital identifié."
            barColor="bg-indigo-500"
            hint={`Extrait des ${data.archives_count} ordonnance(s) scannée(s) sur la période.`}
          />

          {/* === Top médecins === */}
          <RankedSection
            title="Médecins prescripteurs"
            icon={<Stethoscope className="w-4 h-4 text-emerald-600" />}
            items={data.top_doctors}
            emptyText="Aucune ordonnance archivée avec médecin identifié."
            barColor="bg-emerald-500"
          />
        </>
      )}
    </div>
  );
};

const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}> = ({ icon, label, value, tone = 'default' }) => {
  const toneClasses = {
    default: 'bg-white border-gray-100',
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
    danger: 'bg-red-50 border-red-200',
  }[tone];
  return (
    <div className={`rounded-xl border ${toneClasses} px-3 py-2.5`}>
      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className="text-lg font-bold text-gray-900 mt-0.5 tabular-nums">{value}</p>
    </div>
  );
};

const RankedSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: RankedItem[];
  emptyText: string;
  barColor: string;
  hint?: string;
}> = ({ title, icon, items, emptyText, barColor, hint }) => {
  const max = items.reduce((m, it) => Math.max(m, it.count), 0) || 1;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-800 inline-flex items-center gap-2 mb-2">
        {icon}
        {title}
      </h3>
      {hint && <p className="text-[11px] text-gray-500 mb-2 leading-snug">{hint}</p>}
      {items.length === 0 ? (
        <p className="text-xs text-gray-500 italic">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={`${it.name}-${i}`} className="text-xs">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="font-medium text-gray-800 capitalize truncate flex-1">
                  {it.name}
                </span>
                <span className="text-gray-600 tabular-nums shrink-0">{it.count}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full`}
                  style={{ width: `${(it.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default PharmacyAnalyticsTab;

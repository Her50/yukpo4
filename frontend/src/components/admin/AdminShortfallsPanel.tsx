// V2.3 — Dashboard admin : shortfalls du programme de parrainage.
// Affiche les commissions parrainage rolled back (perdues) + at risk
// (initiées non released), avec top parrains affectés et timeline 12 mois.
//
// Accessible par les rôles admin / super_admin (le backend re-vérifie).
//
// Endpoint : GET /api/admin/referrals/shortfalls

import { AlertTriangle, Loader2, RefreshCw, TrendingDown } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../../services/apiService';

interface ShortfallBySource {
  source: string;
  rolled_back_xaf: number;
  rolled_back_count: number;
}

interface ShortfallRecentRow {
  parrain_id: number;
  parrain_phone: string | null;
  source: string;
  amount_xaf: number;
  livre_id: number | null;
  created_at: string;
}

interface ShortfallTopParrain {
  parrain_id: number;
  parrain_phone: string | null;
  total_rolled_back_xaf: number;
  rollback_count: number;
}

interface ShortfallMonthly {
  month: string;
  rolled_back_xaf: number;
}

interface ShortfallsSummary {
  total_rolled_back_xaf: number;
  total_at_risk_xaf: number;
  total_effective_xaf: number;
  by_source: ShortfallBySource[];
  recent: ShortfallRecentRow[];
  top_parrains: ShortfallTopParrain[];
  monthly_12m: ShortfallMonthly[];
}

const fmtXaf = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n) + ' XAF';

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const sourceLabel = (s: string) => {
  if (s.includes('troc')) return 'Troc';
  if (s.includes('seller')) return 'Vente occasion';
  return s;
};

const AdminShortfallsPanel: React.FC = () => {
  const [data, setData] = useState<ShortfallsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet('/api/admin/referrals/shortfalls');
      if (!res.ok) {
        const msg = await res.text();
        setError(msg || `HTTP ${res.status}`);
        setData(null);
        return;
      }
      setData((await res.json()) as ShortfallsSummary);
    } catch (e: any) {
      setError(e?.message || 'Erreur réseau');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
        <div className="font-semibold mb-1">Impossible de charger les shortfalls.</div>
        <div className="text-xs opacity-80">{error}</div>
        <button
          onClick={load}
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700"
        >
          <RefreshCw className="w-3 h-3" /> Réessayer
        </button>
      </div>
    );
  }

  if (!data) return null;

  const maxMonthly = data.monthly_12m.reduce(
    (m, r) => (r.rolled_back_xaf > m ? r.rolled_back_xaf : m),
    1,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-red-500" /> Shortfalls parrainage
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Commissions perdues (rolled back) + commissions en risque (initiées).
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50"
        >
          <RefreshCw className="w-3 h-3" /> Rafraîchir
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Total rolled back"
          value={fmtXaf(data.total_rolled_back_xaf)}
          tone="red"
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <KpiCard
          label="En risque (initiées, non libérées)"
          value={fmtXaf(data.total_at_risk_xaf)}
          tone="amber"
        />
        <KpiCard
          label="Effective (libérée, retirable)"
          value={fmtXaf(data.total_effective_xaf)}
          tone="green"
        />
      </div>

      {/* By source */}
      {data.by_source.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Répartition par source</h3>
          <div className="space-y-2">
            {data.by_source.map((s) => (
              <div
                key={s.source}
                className="flex items-center justify-between text-sm py-2 border-b last:border-0"
              >
                <span className="text-gray-700">{sourceLabel(s.source)}</span>
                <div className="text-right">
                  <div className="font-semibold text-red-600">{fmtXaf(s.rolled_back_xaf)}</div>
                  <div className="text-xs text-gray-400">{s.rolled_back_count} événements</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Monthly timeline */}
      {data.monthly_12m.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Timeline 12 derniers mois</h3>
          <div className="space-y-1">
            {data.monthly_12m.map((m) => (
              <div key={m.month} className="flex items-center gap-3 text-xs">
                <span className="w-16 font-mono text-gray-500">{m.month}</span>
                <div className="flex-1 bg-gray-100 rounded h-3 overflow-hidden">
                  <div
                    className="h-full bg-red-400"
                    style={{ width: `${(m.rolled_back_xaf / maxMonthly) * 100}%` }}
                  />
                </div>
                <span className="w-24 text-right font-semibold text-gray-700">
                  {fmtXaf(m.rolled_back_xaf)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top parrains */}
      {data.top_parrains.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Top 10 parrains affectés
          </h3>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2">Parrain</th>
                <th className="text-right py-2">Rolled back</th>
                <th className="text-right py-2">Événements</th>
              </tr>
            </thead>
            <tbody>
              {data.top_parrains.map((p) => (
                <tr key={p.parrain_id} className="border-b last:border-0">
                  <td className="py-2">
                    <div className="font-medium text-gray-800">#{p.parrain_id}</div>
                    {p.parrain_phone && (
                      <div className="text-xs text-gray-400">{p.parrain_phone}</div>
                    )}
                  </td>
                  <td className="text-right font-semibold text-red-600">
                    {fmtXaf(p.total_rolled_back_xaf)}
                  </td>
                  <td className="text-right text-gray-500">{p.rollback_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Recent events */}
      {data.recent.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            20 derniers événements
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Parrain</th>
                  <th className="text-left py-2">Source</th>
                  <th className="text-right py-2">Montant</th>
                  <th className="text-right py-2">Livre</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 text-gray-500">{fmtDate(r.created_at)}</td>
                    <td className="py-1.5">#{r.parrain_id}</td>
                    <td className="py-1.5">{sourceLabel(r.source)}</td>
                    <td className="py-1.5 text-right font-semibold text-red-600">
                      -{fmtXaf(r.amount_xaf)}
                    </td>
                    <td className="py-1.5 text-right text-gray-500">
                      {r.livre_id ? `#${r.livre_id}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.by_source.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center text-sm text-green-700">
          Aucun shortfall pour le moment. Toutes les commissions sont stables.
        </div>
      )}
    </div>
  );
};

interface KpiCardProps {
  label: string;
  value: string;
  tone: 'red' | 'amber' | 'green';
  icon?: React.ReactNode;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, tone, icon }) => {
  const toneClasses = {
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-80 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
};

export default AdminShortfallsPanel;

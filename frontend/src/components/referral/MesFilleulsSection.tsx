// V2.4 — Section "Mes filleuls" pour le parrain connecté.
// Affiche la liste des filleuls avec, pour chacun :
//   - téléphone masqué (***1234)
//   - date d'inscription, date de conversion
//   - gains : bonus + commission troc + commission vendeur
//   - nb trocs complétés
//
// Endpoint : GET /api/referral/me/filleuls
//
// Permet au parrain d'identifier les filleuls actifs vs inactifs et de
// pousser ceux qui ne convertissent pas encore.

import { ChevronDown, Loader2, RefreshCw, Users } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../../services/apiService';

interface FilleulRow {
  filleul_id: number;
  filleul_phone_masked: string;
  signup_at: string | null;
  converted_at: string | null;
  bonus_xaf: number;
  troc_commission_xaf: number;
  seller_commission_xaf: number;
  total_gains_xaf: number;
  nb_trocs_completes: number;
}

const fmtXaf = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n) + ' XAF';

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
  } catch {
    return iso;
  }
};

const MesFilleulsSection: React.FC = () => {
  const [rows, setRows] = useState<FilleulRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet('/api/referral/me/filleuls');
      if (!res.ok) {
        const msg = await res.text();
        setError(msg || `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as { filleuls: FilleulRow[] };
      setRows(json.filleuls || []);
    } catch (e: any) {
      setError(e?.message || 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="bg-white rounded-2xl border border-amber-200 p-4 sm:p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
        <div className="font-semibold mb-1">Impossible de charger vos filleuls.</div>
        <div className="text-xs opacity-80">{error}</div>
        <button
          onClick={load}
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700"
        >
          <RefreshCw className="w-3 h-3" /> Réessayer
        </button>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="bg-white rounded-2xl border border-amber-200 p-6 text-center">
        <Users className="w-10 h-10 text-amber-400 mx-auto mb-2" />
        <h3 className="font-semibold text-gray-800">Aucun filleul pour le moment</h3>
        <p className="text-xs text-gray-500 mt-1">
          Partage ton code et invite tes amis — chaque inscription apparaît ici.
        </p>
      </section>
    );
  }

  const totalGains = rows.reduce((s, r) => s + r.total_gains_xaf, 0);
  const filleulsConvertis = rows.filter((r) => r.converted_at).length;

  return (
    <section className="bg-white rounded-2xl border border-amber-200 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" /> Mes filleuls
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {rows.length} filleul{rows.length > 1 ? 's' : ''} ·{' '}
            {filleulsConvertis} converti{filleulsConvertis > 1 ? 's' : ''} ·{' '}
            <span className="font-semibold text-amber-700">{fmtXaf(totalGains)}</span>{' '}
            de gains cumulés
          </p>
        </div>
        <button
          onClick={load}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
          aria-label="Rafraîchir"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-gray-100">
        {rows.map((r) => {
          const isExpanded = expandedId === r.filleul_id;
          const isActive = r.total_gains_xaf > 0 || r.nb_trocs_completes > 0;
          return (
            <li key={r.filleul_id} className="py-3">
              <button
                onClick={() => setExpandedId(isExpanded ? null : r.filleul_id)}
                className="w-full flex items-center justify-between gap-3 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                    />
                    <span className="font-medium text-gray-800 text-sm">
                      {r.filleul_phone_masked}
                    </span>
                    <span className="text-xs text-gray-400">#{r.filleul_id}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Inscrit le {fmtDate(r.signup_at)}
                    {r.converted_at && ` · Converti le ${fmtDate(r.converted_at)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-amber-700 text-sm whitespace-nowrap">
                    {fmtXaf(r.total_gains_xaf)}
                  </div>
                  <div className="text-xs text-gray-400">{r.nb_trocs_completes} trocs</div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isExpanded && (
                <div className="mt-3 ml-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {/* 2026-06-29 — libellés clarifiés : on précise QUI fait
                      quoi pour lever l'ambiguïté bonus vente vs commission
                      vente (le filleul est acheteur dans le 1er cas, vendeur
                      dans le 3e). */}
                  <Detail
                    label="Bonus 5 %"
                    sub="quand ton filleul achète"
                    value={fmtXaf(r.bonus_xaf)}
                  />
                  <Detail
                    label="Commission 25 %"
                    sub="quand ton filleul troque"
                    value={fmtXaf(r.troc_commission_xaf)}
                  />
                  <Detail
                    label="Commission 25 %"
                    sub="quand ton filleul vend d'occasion"
                    value={fmtXaf(r.seller_commission_xaf)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {rows.length === 200 && (
        <p className="text-xs text-gray-400 text-center mt-4">
          Affichage limité aux 200 premiers filleuls (par gains décroissants).
        </p>
      )}
    </section>
  );
};

const Detail: React.FC<{ label: string; value: string; sub?: string }> = ({
  label,
  value,
  sub,
}) => (
  <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
    <div className="text-amber-700 opacity-80 font-semibold">{label}</div>
    {sub && <div className="text-[10px] text-amber-700/70 italic">{sub}</div>}
    <div className="font-semibold text-gray-900 mt-0.5">{value}</div>
  </div>
);

export default MesFilleulsSection;

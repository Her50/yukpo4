// ✅ Page admin/librairie — vue d'ensemble du marché Bourse du Livre
// Donne à Yukpo Librairie + admins la visibilité sur l'activité parents :
//   - Stats globales (livres troc/vente/don, matchings effectués)
//   - Activité récente (50 derniers livres + leur statut)
//   - Tableau filtrable par mode et statut

import { BookOpen, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiService';
import { useToast } from '../../hooks/use-toast';

interface MarketGlobal {
  total: number;
  total_troc: number;
  total_vente: number;
  total_don: number;
  troc_matched: number;
  troc_chained: number;
  troc_expired: number;
  sold_or_given: number;
  valeur_totale_xaf: number;
}

interface RecentBook {
  id: number;
  titre: string;
  auteur?: string;
  classe_actuelle?: string;
  classe_souhaitee?: string;
  matiere?: string;
  etat_classification: 'bon' | 'acceptable' | 'rejete';
  prix_detecte?: string | number;
  valeur_calculee?: string | number;
  mode_listing?: 'troc' | 'vente' | 'don';
  troc_status?: 'pending' | 'matched' | 'chained' | 'expired' | string;
  is_available: boolean;
  user_id: number;
  created_at: string;
  updated_at: string;
}

const MODE_COLORS: Record<string, string> = {
  troc: 'bg-emerald-100 text-emerald-800',
  vente: 'bg-orange-100 text-orange-800',
  don: 'bg-blue-100 text-blue-800',
};
const MODE_LABELS: Record<string, string> = {
  troc: 'Troc',
  vente: 'Vente',
  don: 'Don',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  matched: 'bg-emerald-200 text-emerald-900',
  chained: 'bg-amber-200 text-amber-900',
  expired: 'bg-red-100 text-red-700',
  delivered: 'bg-blue-100 text-blue-700',
  returned: 'bg-purple-100 text-purple-700',
};
const TROC_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  matched: 'Apparié',
  chained: 'Chaîné',
  expired: 'Expiré',
  delivered: 'Livré',
  returned: 'Rendu',
};
const ETAT_LABELS: Record<string, string> = {
  bon: 'Bon état',
  acceptable: 'Acceptable',
  rejete: 'Rejeté',
};

const LibrairieMarcheBoursePage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [global, setGlobal] = useState<MarketGlobal | null>(null);
  const [recent, setRecent] = useState<RecentBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState<'all' | 'troc' | 'vente' | 'don'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/bourse-livre/admin/marketplace-overview');
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        setGlobal(data.global);
        setRecent(data.recent_books || []);
      } else {
        toast({
          title: 'Accès refusé',
          description: data?.message || 'Réservé aux admins / librairies.',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({
        title: 'Erreur de chargement',
        description: e?.message || 'Impossible de joindre le serveur.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRecent = recent.filter((b) =>
    modeFilter === 'all' ? true : b.mode_listing === modeFilter,
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-amber-600 px-4 pt-10 pb-5 text-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-full bg-white/20"
            aria-label="Retour"
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Marché Bourse du Livre</h1>
            <p className="text-amber-50 text-xs">Vue d'ensemble admin / librairie</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-full bg-white/20"
            aria-label="Rafraîchir"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-5 space-y-5">
        {loading && !global ? (
          <div className="bg-white p-8 rounded-2xl flex items-center justify-center gap-3 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Chargement…
          </div>
        ) : !global ? (
          <div className="bg-white p-8 rounded-2xl text-center text-gray-500">
            Aucune donnée disponible. Vous n'avez peut-être pas les droits d'accès.
          </div>
        ) : (
          <>
            {/* Stats globales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Total livres (90j)"
                value={global.total}
                color="text-gray-900"
                bg="bg-white"
              />
              <StatCard
                label="🔄 Troc"
                value={global.total_troc}
                color="text-emerald-700"
                bg="bg-emerald-50"
              />
              <StatCard
                label="🛒 Vente"
                value={global.total_vente}
                color="text-orange-700"
                bg="bg-orange-50"
              />
              <StatCard
                label="🎁 Don"
                value={global.total_don}
                color="text-blue-700"
                bg="bg-blue-50"
              />
            </div>

            {/* Stats troc détaillées */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Performance algorithme troc
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniStat label="Pending" value={global.total_troc - global.troc_matched - global.troc_chained - global.troc_expired} color="text-gray-600" />
                <MiniStat label="Matched (en cours)" value={global.troc_matched} color="text-emerald-700" />
                <MiniStat label="Chained (validés)" value={global.troc_chained} color="text-amber-700" />
                <MiniStat label="Expirés" value={global.troc_expired} color="text-red-700" />
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                <span className="text-gray-600">Vendus / donnés</span>
                <span className="font-bold text-orange-700">{global.sold_or_given}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-gray-600">Valeur totale circulant</span>
                <span className="font-bold text-gray-900 tabular-nums">
                  {Math.round(global.valeur_totale_xaf).toLocaleString('fr-FR')} XAF
                </span>
              </div>
            </div>

            {/* Filtres + liste récente */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  Activité récente (50 derniers)
                </p>
                <div className="flex flex-wrap gap-1">
                  {(['all', 'troc', 'vente', 'don'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setModeFilter(m)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        modeFilter === m
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {m === 'all' ? 'Tous' : MODE_LABELS[m] ?? m}
                    </button>
                  ))}
                </div>
              </div>
              {/* MOBILE : cartes empilées (≤ md) */}
              <div className="md:hidden space-y-2">
                {filteredRecent.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">
                    Aucun livre pour ce filtre.
                  </p>
                ) : (
                  filteredRecent.map((b) => (
                    <RecentBookCard key={b.id} book={b} />
                  ))
                )}
              </div>

              {/* DESKTOP : tableau (≥ md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-2 pr-3 font-semibold">Titre</th>
                      <th className="py-2 pr-3 font-semibold">Classe</th>
                      <th className="py-2 pr-3 font-semibold">État</th>
                      <th className="py-2 pr-3 font-semibold">Mode</th>
                      <th className="py-2 pr-3 font-semibold">Statut troc</th>
                      <th className="py-2 pr-3 font-semibold text-right">Valeur</th>
                      <th className="py-2 pr-3 font-semibold">Dispo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecent.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-gray-400">
                          Aucun livre pour ce filtre.
                        </td>
                      </tr>
                    ) : (
                      filteredRecent.map((b) => (
                        <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 pr-3 font-medium text-gray-800">{b.titre}</td>
                          <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{b.classe_actuelle ?? '—'}</td>
                          <td className="py-2 pr-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                                b.etat_classification === 'bon'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {b.etat_classification}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            {b.mode_listing && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                                  MODE_COLORS[b.mode_listing] || 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {b.mode_listing}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {b.troc_status && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                                  STATUS_COLORS[b.troc_status] || 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {TROC_STATUS_LABELS[b.troc_status] ?? b.troc_status}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-gray-700 whitespace-nowrap">
                            {b.valeur_calculee
                              ? `${Math.round(Number(b.valeur_calculee)).toLocaleString('fr-FR')} F`
                              : '—'}
                          </td>
                          <td className="py-2 pr-3">
                            {b.is_available ? (
                              <span className="text-emerald-700">✓</span>
                            ) : (
                              <span className="text-gray-400">×</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Carte mobile compacte d'un livre récent — remplace une ligne du tableau
 * qui était illisible sur smartphone (7 colonnes squashées en 1-2 caractères).
 * Layout : titre + classe sur la 1ère ligne, badges (mode/état/statut) sur la
 * 2ème, valeur + dispo en pied. Tap-zones nettes (44px+) pour mobile.
 */
const RecentBookCard: React.FC<{ book: RecentBook }> = ({ book: b }) => (
  <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-gray-900 leading-tight line-clamp-2">{b.titre}</p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          {b.classe_actuelle || 'Sans classe'}
          {b.matiere ? ` · ${b.matiere}` : ''}
        </p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-0.5">
        <p className="text-base font-bold tabular-nums text-gray-900">
          {b.valeur_calculee
            ? `${Math.round(Number(b.valeur_calculee)).toLocaleString('fr-FR')} F`
            : '—'}
        </p>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            b.is_available
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          {b.is_available ? 'Dispo' : 'Indispo'}
        </span>
      </div>
    </div>

    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {b.mode_listing && (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            MODE_COLORS[b.mode_listing] || 'bg-gray-100 text-gray-700'
          }`}
        >
          {MODE_LABELS[b.mode_listing] ?? b.mode_listing}
        </span>
      )}
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          b.etat_classification === 'bon'
            ? 'bg-emerald-100 text-emerald-700'
            : b.etat_classification === 'acceptable'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700'
        }`}
      >
        {ETAT_LABELS[b.etat_classification] ?? b.etat_classification}
      </span>
      {b.troc_status && (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            STATUS_COLORS[b.troc_status] || 'bg-gray-100 text-gray-700'
          }`}
        >
          {TROC_STATUS_LABELS[b.troc_status] ?? b.troc_status}
        </span>
      )}
    </div>
  </div>
);

const StatCard: React.FC<{ label: string; value: number; color: string; bg: string }> = ({
  label,
  value,
  color,
  bg,
}) => (
  <div className={`${bg} p-3 rounded-2xl shadow-sm`}>
    <p className="text-[10px] uppercase tracking-wide font-bold text-gray-500">{label}</p>
    <p className={`text-2xl font-bold tabular-nums mt-1 ${color}`}>{value}</p>
  </div>
);

const MiniStat: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="text-center">
    <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
    <p className="text-[10px] text-gray-500">{label}</p>
  </div>
);

export default LibrairieMarcheBoursePage;

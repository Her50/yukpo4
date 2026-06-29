// ✅ Tableau de bord parent — Bourse du Livre (web/PWA)
//
// Regroupe en une seule vue les indicateurs qu'un parent suit pendant la
// saison de troc :
//   - Solde Yukpo (crédit, dette, net) + 5 derniers mouvements
//   - Livres publiés (compteur + crédit estimé / libéré)
//   - Commandes passées (compteur + lien Mes commandes)
//   - Colis Bourse (à expédier / à recevoir)
//   - Note pédagogique sur l'impact du crédit
//
// Toutes les chaînes passent par i18n (`bourse.dashboard.*`, 5 langues).
// Layout mobile-first : carte unique colonne < sm, grille 2-col sm:, 3-col lg:.
// Padding-bottom 24 pour ne pas être masqué par la BourseNav fixée.

import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import WalletPayoutSection from '../../components/wallet/WalletPayoutSection'; // ✅ 2026-05-15 PR #3
import { apiGet } from '../../services/apiService';

interface Movement {
  amount: number | string | null;
  direction: 'in' | 'out' | string | null;
  source: string | null;
  note: string | null;
  balance_after: number | string | null;
  created_at: string | null;
}

interface WalletData {
  credit: number;
  debt: number;
  net: number;
  movements: Movement[];
}

interface LivreLite {
  id: number;
  titre?: string;
  // ⚠️ Le modèle Rust LivreScolaire utilise `valeur_calculee` (Decimal)
  //    pour la valeur que Yukpo alloue au livre (prix_detecte × ratio_etat).
  //    Bug initial : on cherchait `prix_estime`/`prix_achat` qui n'existent
  //    pas sur ce modèle → toutes les valeurs sommées à 0.
  valeur_calculee?: number | string | null;
  prix_detecte?: number | string | null;
  // Cycle troc (migration 20260510_008) : pending → matched → chained →
  // delivered | expired | returned. Permet de calculer crédit estimé vs libéré.
  troc_status?: string | null;
  mode_listing?: string | null; // 'vente' | 'echange' | 'troc' | 'don'
  is_available?: boolean;
  is_active?: boolean;
}

interface PackageLite {
  id: string | number;
  expediteur_id?: number | null;
  destinataire_id?: number | null;
  statut?: string | null;
}

interface PurchaseLite {
  id: string | number;
  prix_achat?: number | null;
  statut?: string | null;
}

// ✅ troc_status canonique (migration 20260510_008) :
//   pending  → en attente d'appariement (crédit estimé, non encore acquis)
//   matched  → apparié (crédit provisionnel)
//   chained  → engagé dans une chaîne (crédit verrouillé)
//   delivered → livré : le crédit est libéré dans le wallet de l'user
//   expired / returned → annulé / rollback : pas de crédit
const STATUS_RELEASED = new Set(['delivered']);
const STATUS_PENDING = new Set(['pending', 'matched', 'chained']);

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function fmtAmount(v: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v);
}

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const ParentDashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language || 'fr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [livres, setLivres] = useState<LivreLite[]>([]);
  const [packages, setPackages] = useState<PackageLite[]>([]);
  const [purchases, setPurchases] = useState<PurchaseLite[]>([]);

  const fetchAll = useCallback(async () => {
    setError(null);
    // Chaque endpoint est tolérant à l'échec : on continue avec ce qu'on a.
    // Un user qui n'a JAMAIS rien fait sur la bourse aura des 404 légitimes
    // sur certaines routes — on ne veut pas que ça casse tout le dashboard.
    const safe = async <T,>(path: string, extract: (data: unknown) => T): Promise<T | null> => {
      try {
        const r = await apiGet(path);
        if (!r.ok) return null;
        const data = await r.json();
        return extract(data);
      } catch {
        return null;
      }
    };

    const [walletRes, livresRes, packagesRes, purchasesRes] = await Promise.all([
      safe<WalletData>('/api/bourse-livre/wallet/balance', (d) => {
        const obj = d as Record<string, unknown>;
        return {
          credit: toNumber(obj.wallet_credit_bourse as number | string | null) || toNumber(obj.credit as number | string | null),
          debt: toNumber(obj.bourse_debt_xaf as number | string | null) || toNumber(obj.debt as number | string | null),
          net: toNumber(obj.solde_effectif as number | string | null) || toNumber(obj.net as number | string | null),
          movements: (obj.recent_movements as Movement[] | undefined) ?? (obj.movements as Movement[] | undefined) ?? [],
        };
      }),
      safe<LivreLite[]>('/api/bourse-livre/mes-livres', (d) => {
        const obj = d as Record<string, unknown>;
        return (obj.livres as LivreLite[] | undefined) ?? (obj.data as { livres?: LivreLite[] } | undefined)?.livres ?? [];
      }),
      safe<PackageLite[]>('/api/bourse-livre/v2/packages/my', (d) => {
        const obj = d as Record<string, unknown>;
        return (obj.packages as PackageLite[] | undefined) ?? (obj.data as PackageLite[] | undefined) ?? [];
      }),
      safe<PurchaseLite[]>('/api/bourse-livre/v2/purchases/my', (d) => {
        const obj = d as Record<string, unknown>;
        return (obj.purchases as PurchaseLite[] | undefined) ?? (obj.data as PurchaseLite[] | undefined) ?? [];
      }),
    ]);

    setWallet(walletRes);
    setLivres(livresRes ?? []);
    setPackages(packagesRes ?? []);
    setPurchases(purchasesRes ?? []);

    // On n'affiche d'erreur globale que si TOUT a échoué (probablement réseau ou auth).
    if (!walletRes && !livresRes && !packagesRes && !purchasesRes) {
      setError(t('bourse.dashboard.error'));
    }
  }, [t]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);
    })();
  }, [fetchAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  // Agrégats livres — on somme `valeur_calculee` (= prix_detecte × ratio_etat),
  // calculée par Yukpo à la publication. Fallback sur prix_detecte si manquant.
  const livresPublies = livres.filter((l) => l.is_active !== false);
  const valueOf = (l: LivreLite) => toNumber((l.valeur_calculee ?? l.prix_detecte ?? null) as number | string | null);
  const isReleased = (l: LivreLite) => !!l.troc_status && STATUS_RELEASED.has(l.troc_status);
  const isPending = (l: LivreLite) => !l.troc_status || STATUS_PENDING.has(l.troc_status);
  const estimatedCredit = livresPublies.reduce((acc, l) => (isPending(l) ? acc + valueOf(l) : acc), 0);
  const releasedCredit = livresPublies.reduce((acc, l) => (isReleased(l) ? acc + valueOf(l) : acc), 0);

  // Agrégats colis
  // expediteur_id correspond à l'user → colis "À expédier" ; destinataire_id
  // correspond à l'user → "À recevoir". Le backend renvoie les 2 dans la
  // même liste filtrée côté serveur, mais on a besoin de savoir lequel.
  // Faute d'info user_id côté ici, on suppose la route renvoie déjà filtré
  // et on utilise une heuristique sur le statut.
  const outgoingPackages = packages.filter((p) => {
    const s = (p.statut ?? '').toLowerCase();
    return s.includes('expedie') || s.includes('expédie') || s.includes('attente') || s.includes('en_cours');
  }).length;
  const incomingPackages = packages.filter((p) => {
    const s = (p.statut ?? '').toLowerCase();
    return s.includes('reception') || s.includes('réception') || s.includes('livraison');
  }).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">{t('bourse.dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 sm:mb-6 gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
              {t('bourse.dashboard.title')}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 line-clamp-2">
              {t('bourse.dashboard.subtitle')}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={t('bourse.dashboard.refresh')}
            className="shrink-0 p-2 rounded-full bg-white border border-gray-200 text-amber-600 hover:bg-amber-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={handleRefresh}
              className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold"
            >
              {t('bourse.dashboard.retry')}
            </button>
          </div>
        )}

        {/* ✅ 2026-05-16 — CTA Parrainage TRÈS visible en haut du dashboard.
            Avant : card noyée tout en bas. Maintenant : bouton premium en
            position 1 pour pousser à partager dès l'arrivée sur la page. */}
        <Link
          to="/parrainage"
          className="group block mb-4 sm:mb-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 p-[2px] shadow-lg hover:shadow-xl transition-shadow"
          aria-label={t('bourse.dashboard.referral_cta_aria', {
            defaultValue: 'Ouvrir la page de parrainage',
          })}
        >
          <div className="bg-white rounded-2xl px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 bg-gradient-to-br from-indigo-500 to-amber-500 p-2 sm:p-2.5 rounded-xl shadow-md">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm sm:text-base text-gray-900 leading-tight">
                  {t('bourse.dashboard.referral_cta_title', {
                    defaultValue: 'Parrainez et gagnez à vie',
                  })}
                </p>
                <p className="text-[11px] sm:text-xs text-gray-600 leading-snug mt-0.5">
                  {t('bourse.dashboard.referral_cta_sub', {
                    defaultValue:
                      '5 % sur les achats de vos filleuls + 25 % sur leurs trocs + 25 % sur leurs ventes d\'occasion. À vie.',
                  })}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-indigo-600 shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* ✅ 2026-05-16 — Carte "Mes ventes / Mon troc" : 4 métriques
            dérivées de l'array `livres`. Affichée juste après le CTA
            parrainage car c'est la situation principale du parent vendeur. */}
        {(() => {
          const isSale = (l: LivreLite) => l.mode_listing === 'vente';
          const isPending = (l: LivreLite) =>
            STATUS_PENDING.has((l.troc_status ?? 'pending').toLowerCase());
          const isReleased = (l: LivreLite) =>
            STATUS_RELEASED.has((l.troc_status ?? '').toLowerCase());

          const enVente = livres.filter((l) => isSale(l) && isPending(l)).length;
          const vendus = livres.filter((l) => isSale(l) && isReleased(l)).length;
          const enTroc = livres.filter((l) => !isSale(l) && isPending(l)).length;
          const troques = livres.filter((l) => !isSale(l) && isReleased(l)).length;

          // Si l'utilisateur n'a aucun livre, on cache la carte (pas
          // pertinent pour un parent qui n'a pas encore publié).
          const totalLivres = livres.length;
          if (totalLivres === 0) return null;

          return (
            <Link
              to="/mes-livres"
              className="block mb-4 sm:mb-6 bg-white rounded-2xl border-2 border-blue-200 hover:border-blue-300 p-3 sm:p-4 shadow-sm hover:shadow-md transition-all"
              aria-label={t('bourse.dashboard.troc_card_aria', {
                defaultValue: 'Voir le détail de mes livres en vente et en troc',
              })}
            >
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
                  <h2 className="font-bold text-sm sm:text-base text-gray-900">
                    {t('bourse.dashboard.troc_title', {
                      defaultValue: 'Mes ventes & mon troc',
                    })}
                  </h2>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-600 shrink-0" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <TrocTile
                  label={t('bourse.dashboard.troc_in_sale', { defaultValue: 'En vente' })}
                  value={enVente}
                  color="amber"
                />
                <TrocTile
                  label={t('bourse.dashboard.troc_sold', { defaultValue: 'Vendus' })}
                  value={vendus}
                  color="emerald"
                />
                <TrocTile
                  label={t('bourse.dashboard.troc_in_swap', { defaultValue: 'En troc' })}
                  value={enTroc}
                  color="blue"
                />
                <TrocTile
                  label={t('bourse.dashboard.troc_swapped', { defaultValue: 'Troqués' })}
                  value={troques}
                  color="indigo"
                />
              </div>
            </Link>
          );
        })()}

        {/* Wallet (hero) */}
        <section
          className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-4 sm:p-6 shadow-lg mb-4 sm:mb-6"
          aria-labelledby="wallet-title"
        >
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5" />
            <h2 id="wallet-title" className="font-semibold text-sm sm:text-base">
              {t('bourse.dashboard.wallet.title')}
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-wide text-amber-100">
                {t('bourse.dashboard.wallet.credit')}
              </p>
              <p className="text-lg sm:text-2xl font-bold tabular-nums leading-tight">
                {fmtAmount(toNumber(wallet?.credit ?? 0), locale)}
              </p>
              <p className="text-[10px] sm:text-xs text-amber-100">
                {t('bourse.dashboard.wallet.currency')}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-wide text-amber-100">
                {t('bourse.dashboard.wallet.debt')}
              </p>
              <p className="text-lg sm:text-2xl font-bold tabular-nums leading-tight">
                {fmtAmount(toNumber(wallet?.debt ?? 0), locale)}
              </p>
              <p className="text-[10px] sm:text-xs text-amber-100">
                {t('bourse.dashboard.wallet.currency')}
              </p>
            </div>
            <div className="border-l border-white/30 pl-2 sm:pl-4">
              <p className="text-[10px] sm:text-xs uppercase tracking-wide text-amber-100">
                {t('bourse.dashboard.wallet.net')}
              </p>
              <p className="text-lg sm:text-2xl font-bold tabular-nums leading-tight">
                {fmtAmount(toNumber(wallet?.net ?? 0), locale)}
              </p>
              <p className="text-[10px] sm:text-xs text-amber-100">
                {t('bourse.dashboard.wallet.currency')}
              </p>
            </div>
          </div>
        </section>

        {/* Grille 2-col tablette, 1-col mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Mes livres */}
          <section
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col"
            aria-labelledby="books-title"
          >
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              <h3 id="books-title" className="font-semibold text-sm sm:text-base text-gray-900">
                {t('bourse.dashboard.books.title')}
              </h3>
            </div>
            {livresPublies.length === 0 ? (
              <>
                <p className="text-sm text-gray-500 flex-1">{t('bourse.dashboard.books.empty')}</p>
                <button
                  onClick={() => navigate('/vendre')}
                  className="mt-3 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2 rounded-xl"
                >
                  {t('bourse.dashboard.books.cta_sell')}
                </button>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">
                  {t('bourse.dashboard.books.count', {
                    count: livresPublies.length,
                    defaultValue: `${livresPublies.length}`,
                  })}
                </p>
                <div className="mt-3 space-y-1.5 text-xs sm:text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">
                      {t('bourse.dashboard.books.estimated_credit')}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {fmtAmount(estimatedCredit, locale)} {t('bourse.dashboard.wallet.currency')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">
                      {t('bourse.dashboard.books.released')}
                    </span>
                    <span className="font-semibold tabular-nums text-emerald-600">
                      {fmtAmount(releasedCredit, locale)} {t('bourse.dashboard.wallet.currency')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/mes-livres')}
                  className="mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-900 self-start"
                >
                  {t('bourse.dashboard.books.manage')} →
                </button>
              </>
            )}
          </section>

          {/* Mes commandes */}
          <section
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col"
            aria-labelledby="orders-title"
          >
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
              <h3 id="orders-title" className="font-semibold text-sm sm:text-base text-gray-900">
                {t('bourse.dashboard.orders.title')}
              </h3>
            </div>
            {purchases.length === 0 ? (
              <p className="text-sm text-gray-500 flex-1">
                {t('bourse.dashboard.orders.empty')}
              </p>
            ) : (
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {t('bourse.dashboard.orders.count', {
                  count: purchases.length,
                  defaultValue: `${purchases.length}`,
                })}
              </p>
            )}
            <button
              onClick={() => navigate('/mes-commandes')}
              className="mt-3 text-sm font-semibold text-indigo-700 hover:text-indigo-900 self-start"
            >
              {t('bourse.dashboard.orders.see_all')} →
            </button>
          </section>

          {/* Colis Bourse */}
          <section
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col"
            aria-labelledby="packages-title"
          >
            <div className="flex items-center gap-2 mb-3">
              <PackageCheck className="w-5 h-5 text-sky-600" />
              <h3 id="packages-title" className="font-semibold text-sm sm:text-base text-gray-900">
                {t('bourse.dashboard.packages.title')}
              </h3>
            </div>
            {packages.length === 0 ? (
              <p className="text-sm text-gray-500 flex-1">
                {t('bourse.dashboard.packages.empty')}
              </p>
            ) : (
              <div className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">
                    {t('bourse.dashboard.packages.outgoing')}
                  </span>
                  <span className="font-semibold tabular-nums">{outgoingPackages}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">
                    {t('bourse.dashboard.packages.incoming')}
                  </span>
                  <span className="font-semibold tabular-nums">{incomingPackages}</span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Derniers mouvements */}
        <section
          className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4 sm:mb-6"
          aria-labelledby="movements-title"
        >
          <h3 id="movements-title" className="font-semibold text-sm sm:text-base text-gray-900 mb-3">
            {t('bourse.dashboard.wallet.recent_movements')}
          </h3>
          {!wallet?.movements?.length ? (
            <p className="text-sm text-gray-500">{t('bourse.dashboard.wallet.no_movements')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {wallet.movements.map((m, idx) => {
                // ✅ Le backend renvoie direction='credit'|'debit' (pas 'in'|'out').
                //    Voir migration 20260510_008 et bourse_livre_v2_controller.rs:282.
                const isIn = m.direction === 'credit' || m.direction === 'in';
                // ✅ Mapping des sources backend canoniques :
                //    troc_credit_provisional → "Échange en attente"
                //    troc_credit_engaged     → "Échange engagé"
                //    troc_credit_rolled_back → "Échange annulé"
                //    order_credit_used       → "Commande" (consommation au checkout)
                //    consignation_recovery   → "Récupération vente boutique"
                //    manual_admin_adjustment → "Ajustement admin"
                //    Cf. migration 20260510_008_troc_credit_bourse.sql lignes 68-75.
                const sourceKey = `bourse.dashboard.wallet.source_${m.source ?? 'unknown'}`;
                const sourceLabel = m.source
                  ? t(sourceKey, { defaultValue: m.source })
                  : t('bourse.dashboard.wallet.source_unknown', { defaultValue: '—' });
                return (
                  <li key={idx} className="py-2.5 flex items-center gap-3">
                    <span
                      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {isIn ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{sourceLabel}</p>
                      <p className="text-[11px] text-gray-500">{fmtDate(m.created_at, locale)}</p>
                    </div>
                    <span
                      className={`text-sm font-bold tabular-nums whitespace-nowrap ${
                        isIn ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isIn ? '+' : '−'}
                      {fmtAmount(toNumber(m.amount), locale)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ✅ 2026-05-15 PR #3 — Retrait cash. S'auto-masque si solde wallet
            sous le seuil minimum ET aucun historique de demandes. */}
        <WalletPayoutSection />

        {/* Impact pédagogique */}
        <section
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3"
          aria-labelledby="impact-title"
        >
          <TrendingUp className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 id="impact-title" className="font-semibold text-sm text-emerald-900">
              {t('bourse.dashboard.impact.title')}
            </h3>
            <p className="text-xs sm:text-sm text-emerald-800 mt-1 leading-relaxed">
              {t('bourse.dashboard.impact.desc')}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

// ✅ 2026-05-16 — Mini tile pour la carte "Mes ventes & mon troc"
const TrocTile: React.FC<{
  label: string;
  value: number;
  color: 'amber' | 'emerald' | 'blue' | 'indigo';
}> = ({ label, value, color }) => {
  const colorMap = {
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  };
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${colorMap[color]}`}>
      <p className="text-[9px] uppercase font-bold tracking-wider opacity-80">{label}</p>
      <p className="text-lg sm:text-xl font-bold tabular-nums leading-tight">{value}</p>
    </div>
  );
};

export default ParentDashboardPage;

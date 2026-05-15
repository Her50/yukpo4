import {
  Camera, ChevronRight, LogOut, Pencil, Repeat, School, ShoppingCart, Sparkles, Store, Wallet,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcherBourse from '../../components/LanguageSwitcherBourse';
import { useParentShop } from '../../hooks/useParentShop';
import { useUser } from '../../hooks/useUser';
import { apiGet } from '../../services/apiService';

/**
 * Page d'accueil minimaliste de la Bourse du Livre.
 *
 * Volonté produit : à la rentrée scolaire le parent ouvre l'app, scanne sa
 * liste, valide les articles, passe la commande. Aucun parasite — un seul
 * bouton CTA. Tout le reste (vendre/troc/livreur/établissement…) reste
 * accessible par URL directe pour les rôles avancés, mais n'apparaît plus
 * sur la home.
 */
/**
 * Saisonnalité de la rentrée scolaire (Cameroun par défaut).
 *   • mai–juillet : période 'troc' (priorité : vendre / échanger ses vieux livres)
 *   • août–septembre : période 'achat' (priorité : préparer la rentrée)
 *   • reste de l'année : 'creuse' (entre deux rentrées)
 * Les bornes peuvent évoluer par pays — pour V1 on prend le calendrier CM.
 */
type SchoolSeason = 'troc' | 'achat' | 'creuse';
const getCurrentSchoolSeason = (now: Date = new Date()): SchoolSeason => {
  const m = now.getMonth(); // 0-indexed
  if (m >= 4 && m <= 6) return 'troc'; // mai (4) à juillet (6)
  if (m === 7 || m === 8) return 'achat'; // août (7) à septembre (8)
  return 'creuse';
};

const LivreScolaireHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { totalItems } = useParentShop();
  const { user, isLoading } = useUser();
  // ✅ Solde Yukpo dynamique — affiché dans le header. Source de vérité backend
  // (peut différer du localStorage si l'user a fait un troc/commande depuis).
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet('/api/bourse-livre/wallet/balance');
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.success) {
          // Solde effectif = crédit − dette (peut être négatif).
          // Fallback : si solde_effectif absent (ancien backend), utiliser le
          // crédit positif sans tenir compte de la dette.
          const net = data.solde_effectif ?? data.wallet_credit_bourse ?? 0;
          setWalletBalance(Number(net));
        }
      } catch { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  }, [user]);
  // Saison détectée automatiquement à chaque render — bornes CM pour V1.
  // Re-évaluée à chaque mount, ce qui suffit pour une PWA ouverte ponctuellement.
  const season: SchoolSeason = useMemo(() => getCurrentSchoolSeason(), []);

  // ✅ 2026-05-08 v3 : connexion obligatoire pour tous (parents + partenaires).
  // Une fois le compte créé, le JWT reste en localStorage → pas de reconnexion
  // à chaque visite. Si pas de token, redirection vers /login (qui propose le
  // bouton "Devenir partenaire" pour les écoles, libraires, etc.).
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login?source=shared_service&redirect=%2F', { replace: true });
    }
  }, [isLoading, user, navigate]);

  // ✅ 2026-05-15 : Onboarding lieu de livraison au 1er login. Si l'user n'a
  // pas encore enregistré son adresse persistante (delivery_location_saved_at
  // null), on le redirige vers /onboarding/livraison. Une fois saved, plus
  // jamais redirigé. Ce lieu sert au matching troc (proximité) + livraison.
  useEffect(() => {
    if (!user || isLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet('/api/users/me/delivery-info');
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data?.success && data?.onboarding_done === false) {
          navigate('/onboarding/livraison', { replace: true });
        }
      } catch {
        // silencieux — l'user pourra renseigner plus tard
      }
    })();
    return () => { cancelled = true; };
  }, [user, isLoading, navigate]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <p className="text-sm text-gray-500">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-600 via-amber-500 to-amber-400 flex flex-col">
      {/* Header — épuré : titre + sous-titre directif court */}
      <div className="px-5 pt-10 pb-5 text-white">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold leading-tight">{t('bourse.home.title')}</h1>
          <div className="flex items-center gap-2">
            <LanguageSwitcherBourse tone="white" />
            {totalItems > 0 && (
              <button
                onClick={() => navigate('/recap')}
                className="relative flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-full"
                aria-label="Voir mon récapitulatif"
              >
                <ShoppingCart className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-semibold">{totalItems}</span>
              </button>
            )}
            {/* Bouton déconnexion — toujours visible pour permettre un
                logout/relogin rapide en cas de token expiré. */}
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('token');
                  localStorage.removeItem('yukpo_guest_account');
                  window.dispatchEvent(new Event('tokens_updated'));
                } catch {/* nothing */}
                navigate('/login');
              }}
              className="flex items-center justify-center bg-white/20 backdrop-blur-sm w-9 h-9 rounded-full active:bg-white/30"
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
        <p className="text-amber-50 text-sm mt-1.5 font-medium">{t('bourse.home.subtitle')}</p>
        {/* Solde Yukpo dynamique — toujours visible. Permet à l'utilisateur de
            connaître son crédit avant de passer une nouvelle commande. */}
        {walletBalance !== null && (
          <button
            onClick={() => navigate('/mes-livres')}
            className="mt-3 w-full flex items-center justify-between bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 active:bg-white/25"
            aria-label="Voir détails du crédit"
          >
            <div className="flex items-center gap-2.5">
              <Wallet className="w-5 h-5 text-white" />
              <span className="text-white text-sm font-medium">Bon d'achat Yukpo disponible</span>
            </div>
            <div className="text-right">
              <p className={`text-white font-bold text-base tabular-nums ${walletBalance < 0 ? 'text-red-100' : ''}`}>
                {walletBalance >= 0 ? '' : '−'}{Math.abs(walletBalance).toLocaleString('fr-FR')} <span className="text-xs font-normal">XAF</span>
              </p>
              {walletBalance < 0 && (
                <p className="text-[10px] text-red-100">À régler au prochain achat</p>
              )}
            </div>
          </button>
        )}
      </div>

      {/* ✅ 2026-05-10 : accueil épuré — header amber compact, puis directement
          les 3 cartes source (école partenaire en priorité, photo, suggestions).
          Pas d'intro paragraphique : chaque carte porte sa propre description. */}
      <div className="flex-1 bg-white rounded-t-3xl px-5 pt-6 pb-24 flex flex-col">
        <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
          {/* Reprise : si le parent a déjà des articles dans son panier */}
          {totalItems > 0 && (
            <button
              onClick={() => navigate('/rentree')}
              className="w-full mb-4 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 text-white font-bold py-3.5 rounded-2xl text-sm shadow-md shadow-amber-200/60 min-h-[52px]"
            >
              <ShoppingCart className="w-4 h-4" />
              {t('bourse.home.continue_cta')} ({totalItems})
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* ✅ 2026-05-11 — Bannière saisonnière + CTA contextuel.
              Pendant la période 'troc' (mai-juillet), on met en avant
              la vente/échange des vieux livres. Pendant 'achat' (août-sept),
              les 3 sources d'ajout de liste sont prioritaires. Pendant
              'creuse', un message d'attente + accès direct au compte. */}
          {/* ✅ 2026-05-15 : CTA troc épuré pour s'aligner visuellement
              avec les 2 autres boutons (école partenaire + scan). Avant :
              border-2 émeraude + shadow-md + 3 lignes de texte qui le
              rendaient disproportionné. Maintenant : même structure que
              les autres (min-h 80, icône 10x10, titre + 1 ligne desc). */}
          {season === 'troc' && (
            <button
              onClick={() => navigate('/vendre')}
              className="w-full bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-200 text-left active:bg-gray-50 min-h-[80px]"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Repeat className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900">
                    {t('bourse.home.season_troc_title')}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-snug">
                    {t('bourse.home.season_troc_desc')}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-600 mt-2 flex-shrink-0" />
              </div>
            </button>
          )}

          {season === 'creuse' && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4">
              <p className="text-xs text-blue-800 leading-snug">
                {t('bourse.home.season_creuse_msg')}
              </p>
            </div>
          )}

          {/* Lien secondaire vers troc en saison 'achat' (parent qui a encore
              des vieux livres à liquider entre 2 rentrées) */}
          {season === 'achat' && (
            <button
              onClick={() => navigate('/vendre')}
              className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3 text-left active:bg-emerald-100 inline-flex items-center gap-2"
            >
              <Repeat className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
              <span className="text-xs font-semibold text-emerald-800 flex-1">
                {t('bourse.home.season_achat_troc_link')}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-emerald-700" />
            </button>
          )}

          {/* 1. École partenaire (PRIORITÉ — sauf en saison creuse où on
              désaccentue pour ne pas suggérer une rentrée qui n'arrive pas) */}
          <button
            onClick={() => navigate('/recherche-ecole')}
            className={`w-full rounded-2xl p-4 mb-3 shadow-sm text-left min-h-[80px] ${
              season === 'achat'
                ? 'bg-white border-2 border-amber-300 active:bg-amber-50'
                : 'bg-white border border-gray-200 active:bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <School className="w-5 h-5 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-gray-900">{t('bourse.home.partner_school_cta')}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-snug">{t('bourse.home.partner_school_description')}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-700 mt-2 flex-shrink-0" />
            </div>
          </button>

          {/* 2. Scan list (FALLBACK) */}
          <button
            onClick={() => navigate('/scan-programme')}
            className="w-full bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-200 text-left active:bg-gray-50 min-h-[80px]"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                <Camera className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-gray-900">{t('bourse.home.scan_cta')}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-snug">{t('bourse.home.scan_description')}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-600 mt-2 flex-shrink-0" />
            </div>
          </button>

          {/* ✅ 2026-05-15 : 3. Cahiers & Accessoires (page agrégée multi-classes) */}
          <button
            onClick={() => navigate('/cahiers-accessoires')}
            className="w-full bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-200 text-left active:bg-gray-50 min-h-[80px]"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center flex-shrink-0">
                <Pencil className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-gray-900">{t('bourse.home.cahiers_cta')}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-snug">{t('bourse.home.cahiers_description')}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-600 mt-2 flex-shrink-0" />
            </div>
          </button>

          {/* ✅ 2026-05-13 : Bouton "Suggestions intelligentes" SUPPRIMÉ.
              Son contenu (programme national + accessoires populaires par
              classe) est désormais strictement équivalent à celui de la
              page "Établissement partenaire" quand aucune école n'est
              choisie (programme national par défaut). Garde une seule
              porte d'entrée pour réduire la confusion utilisateur. */}

          {/* Liens discrets vers les portails (connexion requise) */}
          <div className="mt-auto pt-8 flex flex-col items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Yukpo
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => navigate('/librairie')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-indigo-700"
              >
                <Store className="w-3.5 h-3.5" />
                {t('bourse.home.librairie_portal')}
                <ChevronRight className="w-3 h-3 opacity-60" />
              </button>
              <button
                onClick={() => navigate('/etablissement-portal')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-emerald-700"
              >
                <School className="w-3.5 h-3.5" />
                {t('bourse.home.etablissement_portal')}
                <ChevronRight className="w-3 h-3 opacity-60" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivreScolaireHomePage;

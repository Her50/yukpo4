import {
  Camera, ChevronRight, Repeat, School, ShoppingCart, Sparkles, Store,
} from 'lucide-react';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcherBourse from '../../components/LanguageSwitcherBourse';
import { useParentShop } from '../../hooks/useParentShop';
import { useUser } from '../../hooks/useUser';

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
          </div>
        </div>
        <p className="text-amber-50 text-sm mt-1.5 font-medium">{t('bourse.home.subtitle')}</p>
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
          {season === 'troc' && (
            <>
              <button
                onClick={() => navigate('/vendre')}
                className="w-full bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 mb-2 shadow-md border-2 border-emerald-400 text-left active:from-green-100 min-h-[96px]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Repeat className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                      {t('bourse.home.season_troc_badge')}
                    </div>
                    <div className="font-bold text-base text-emerald-900 leading-tight mt-0.5">
                      {t('bourse.home.season_troc_title')}
                    </div>
                    <div className="text-xs text-emerald-800 mt-1 leading-snug">
                      {t('bourse.home.season_troc_desc')}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-emerald-700 mt-2 flex-shrink-0" />
                </div>
              </button>
              {/* Avertissement éligibilité — visible AVANT que le parent ne se
                  lance dans la photo capture, pour éviter les rejets surprises */}
              <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-snug">
                <strong>{t('bourse.home.eligibility_warning_title')}</strong> {t('bourse.home.eligibility_warning_desc')}
              </div>
            </>
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

          {/* 3. Manuel (suggestions intelligentes) */}
          <button
            onClick={() => navigate('/rentree?suggestions=1')}
            className="w-full bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-200 text-left active:bg-gray-50 min-h-[80px]"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-gray-900">{t('bourse.home.manual_cta')}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-snug">{t('bourse.home.manual_description')}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-600 mt-2 flex-shrink-0" />
            </div>
          </button>

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

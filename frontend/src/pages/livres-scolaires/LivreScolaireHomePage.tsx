import {
  Camera, ChevronRight, School, ShoppingCart, Sparkles, Store,
} from 'lucide-react';
import React, { useEffect } from 'react';
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
const LivreScolaireHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { totalItems } = useParentShop();
  const { user, isLoading } = useUser();

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
      {/* Header */}
      <div className="px-5 pt-12 pb-6 text-white">
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
        <p className="text-amber-50 text-sm mt-1">{t('bourse.home.subtitle')}</p>
      </div>

      {/* ✅ 2026-05-10 : 3 sources directement sur l'accueil — école partenaire en
          tête (priorité), scan en 2e (fallback liste papier), suggestions
          intelligentes en 3e. Plus de doublon "Scanner ma liste" : c'est une des
          trois cartes ci-dessous. */}
      <div className="flex-1 bg-white rounded-t-3xl px-5 pt-7 pb-24 flex flex-col">
        <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
          {/* Pitch : trois façons d'établir sa liste */}
          <p className="text-sm text-gray-600 leading-relaxed text-center mb-5">
            {t('bourse.home.intro')}
          </p>

          {/* Reprise : si le parent a déjà des articles dans son panier */}
          {totalItems > 0 && (
            <button
              onClick={() => navigate('/rentree')}
              className="w-full mb-5 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 text-white font-bold py-3.5 rounded-2xl text-sm shadow-md shadow-amber-200/60 min-h-[52px]"
            >
              <ShoppingCart className="w-4 h-4" />
              {t('bourse.home.continue_cta')} ({totalItems})
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* 1. École partenaire (PRIORITÉ) */}
          <button
            onClick={() => navigate('/recherche-ecole')}
            className="w-full bg-white rounded-2xl p-4 mb-3 shadow-sm border-2 border-amber-300 text-left active:bg-amber-50 min-h-[80px]"
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

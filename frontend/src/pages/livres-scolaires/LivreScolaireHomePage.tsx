import {
  Camera, ChevronRight, ScanLine, School, Search, ShoppingCart, Sparkles, Store,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useParentShop } from '../../hooks/useParentShop';

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
  // ✅ 2026-05-08 v2 : la home parent reste accessible en mode invité auto
  // (useGuestAuth dans BourseLayout). L'authentification est exigée uniquement
  // aux portails partenaires (Librairie, Établissement) via RequireAuth.

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-600 via-amber-500 to-amber-400 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-12 pb-6 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold leading-tight">{t('bourse.home.title')}</h1>
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
        <p className="text-amber-50 text-sm mt-1">{t('bourse.home.subtitle')}</p>
      </div>

      {/* Carte centrale ultra-simple : 1 bouton de scan */}
      <div className="flex-1 bg-white rounded-t-3xl px-5 pt-8 pb-24 flex flex-col">
        <div className="max-w-md w-full mx-auto flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-200 mb-5">
            <ScanLine className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-1.5">
            {t('bourse.home.scan_cta')}
          </h2>
          <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-7">
            {t('bourse.home.scan_description')}
          </p>

          <button
            onClick={() => navigate('/scan-programme')}
            className="w-full max-w-sm flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 text-white font-bold py-4 rounded-2xl text-base shadow-md shadow-amber-200/60"
          >
            <Camera className="w-5 h-5" />
            {t('bourse.home.scan_cta')}
            <ChevronRight className="w-5 h-5 ml-1" />
          </button>

          {/* Séparateur visuel */}
          <div className="flex items-center gap-3 my-5 w-full max-w-sm">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-400 uppercase tracking-wider">
              {t('bourse.home.or')}
            </span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* CTA secondaire — école partenaire */}
          <button
            onClick={() => navigate('/recherche-ecole')}
            className="w-full max-w-sm flex items-center justify-center gap-2.5 bg-white border-2 border-amber-300 active:bg-amber-50 text-amber-800 font-semibold py-3.5 rounded-2xl text-sm"
          >
            <Search className="w-4.5 h-4.5" />
            {t('bourse.home.partner_school_cta')}
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>

          {totalItems > 0 && (
            <button
              onClick={() => navigate('/recap')}
              className="mt-4 text-sm font-semibold text-amber-700 underline-offset-4 hover:underline flex items-center gap-1.5"
            >
              <ShoppingCart className="w-4 h-4" />
              {t('bourse.home.cart_count', { count: totalItems })}
            </button>
          )}

          <div className="mt-10 flex items-center gap-1.5 text-xs text-gray-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Yukpo
          </div>

          {/* Liens discrets vers les portails (connexion requise) */}
          <div className="mt-8 flex flex-col items-center gap-2.5">
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
  );
};

export default LivreScolaireHomePage;

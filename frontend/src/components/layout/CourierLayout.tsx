// 2026-06-28 — Wrapper layout pour les pages coursier Bourse du Livre.
//
// Remplace l'usage d'AppLayout legacy (dark mode + ancien logo "yukpomnang+XAF")
// qui n'a aucun sens dans le flux coursier où on veut une UI claire et un
// branding cohérent avec le reste de la Bourse.
//
// Header sticky minimal : retour Bourse + titre "Espace Coursier".
// Aucun bitmap logo — l'identité passe par le typographique et la couleur
// (orange amber, comme le reste de la Bourse).

import { ArrowLeft, Truck } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

interface CourierLayoutProps {
  children: React.ReactNode;
  /** Titre affiché à droite du logo (ex: "Inscription", "Mes livraisons"). */
  pageTitle?: string;
  /** Lien retour personnalisé. Défaut : `/` (home bourse). */
  backTo?: string;
  /** Affiche le bouton retour (défaut true). Mettre à false sur la home coursier. */
  showBack?: boolean;
}

const CourierLayout: React.FC<CourierLayoutProps> = ({
  children,
  pageTitle,
  backTo = '/',
  showBack = true,
}) => (
  <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-white to-white">
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-amber-100 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {showBack && (
            <Link
              to={backTo}
              className="p-1.5 rounded hover:bg-amber-50 text-amber-700"
              aria-label="Retour"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <Truck className="w-5 h-5 text-amber-700 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-amber-800 leading-none">
              Espace Coursier
            </div>
            <div className="text-[11px] text-amber-700/80 leading-none mt-0.5">
              Bourse du Livre Yukpo
            </div>
          </div>
        </div>
        {pageTitle && (
          <div className="text-xs sm:text-sm text-slate-500 truncate">{pageTitle}</div>
        )}
      </div>
    </header>
    <main>{children}</main>
  </div>
);

export default CourierLayout;

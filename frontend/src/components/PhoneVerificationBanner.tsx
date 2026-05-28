// =============================================================================
// PhoneVerificationBanner — invite non-bloquante à vérifier son numéro
// =============================================================================
// 2026-05-28 — S'affiche en haut des pages Bourse quand l'utilisateur est
// connecté avec un compte phone+PIN qui n'a pas encore prouvé qu'il possède
// la SIM (phone_verified = false). Volontairement non-bloquant :
//   * Achats de livres / cahiers → permis (paie de sa poche, aucun risque
//     pour autrui).
//   * Cash-out parrainage + créer un troc → gatés côté backend, l'API
//     renvoie 403 avec un message clair que ce banner annonce déjà.
//
// Dismissible 7 jours via localStorage pour ne pas harceler.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { useUser } from '@/hooks/useUser';

const STORAGE_KEY = 'yukpo_phone_verif_dismissed';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

const PhoneVerificationBanner: React.FC = () => {
  const { user } = useUser();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Ne s'affiche que si l'utilisateur a un téléphone non vérifié.
    if (user.phone_verified !== false) return;
    if (!user.phone) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const ts = parseInt(stored, 10);
      if (!Number.isNaN(ts) && Date.now() - ts < DISMISS_MS) return;
      localStorage.removeItem(STORAGE_KEY);
    }
    setVisible(true);
  }, [user]);

  const onDismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center gap-3 text-xs">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
        !
      </span>
      <div className="flex-1 min-w-0 text-amber-900 leading-snug">
        <strong>Validez votre numéro</strong> pour activer le troc et le
        retrait des bonus parrainage. Passez chez une librairie Yukpo
        partenaire ou attendez la vérification automatique par SMS.
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer"
        className="flex-shrink-0 w-6 h-6 text-amber-700 hover:text-amber-900 font-bold"
      >
        ×
      </button>
    </div>
  );
};

export default PhoneVerificationBanner;

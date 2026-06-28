import React from 'react';
import { createRoot } from 'react-dom/client';
import AppBourse from './AppBourse';
import './i18n/i18nAutoDetector'; // i18n + détection auto langue système téléphone
import './index.css';
import { captureRefFromUrl } from './utils/referralStorage'; // ✅ 2026-05-15 : parrainage ?ref=XXX

// ✅ 2026-05-15 — Capture le code parrain dès le boot (avant rendu), pour
// que même si l'user n'arrive jamais sur la page d'inscription, le code soit
// déjà tracké côté backend. Le call backend est fire-and-forget.
captureRefFromUrl();

// ✅ 2026-05-08 — Kill-switch : si l'app détecte une migration majeure (changement
// de version), elle purge tous les Service Workers + caches + storage et recharge.
// Bumper la constante BOURSE_APP_VERSION force la purge chez tous les clients.
const BOURSE_APP_VERSION = 'v27-2026-06-28-16h';
(async () => {
  try {
    const lastVersion = localStorage.getItem('bourse_app_version');
    if (lastVersion !== BOURSE_APP_VERSION) {
      console.log(`[Bourse] Migration ${lastVersion} → ${BOURSE_APP_VERSION} : purge en cours…`);
      // Désinscrire les SW
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      // Vider les caches
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(c => caches.delete(c)));
      }
      // Préserver token & guest flag uniquement si présents et non corrompus
      const token = localStorage.getItem('token');
      const guestFlag = localStorage.getItem('yukpo_guest_account');
      // Le guest flag est obsolète depuis v3 : on le retire systématiquement
      localStorage.removeItem('yukpo_guest_account');
      // Vider sessionStorage (rarement utile à conserver)
      sessionStorage.clear();
      // Marquer la version pour ne pas re-purger au prochain reload
      localStorage.setItem('bourse_app_version', BOURSE_APP_VERSION);
      // Si on avait un token guest (créé par l'ancien useGuestAuth), on le purge
      // pour forcer la création d'un vrai compte.
      if (guestFlag && token) {
        localStorage.removeItem('token');
      }
      console.log('[Bourse] Purge terminée. Rechargement…');
      // Reload doux pour repartir sur un état propre
      setTimeout(() => location.reload(), 100);
      return;
    }
  } catch (e) {
    console.warn('[Bourse] Kill-switch: erreur silencieuse', e);
  }
})();

const showError = (msg: string) => {
  // ✅ 2026-05-16 — Pas d'innerHTML avec interpolation : si `msg` contient
  // un message d'erreur venant du backend qui inclut du HTML (ex: response
  // body rendu en string dans une Error), on aurait du XSS au boot.
  // textContent échappe automatiquement.
  document.body.style.cssText = 'margin:0;padding:20px;font-family:monospace;background:#fff';
  const h2 = document.createElement('h2');
  h2.style.color = 'red';
  h2.textContent = 'Erreur de démarrage';
  const pre = document.createElement('pre');
  pre.style.cssText = 'white-space:pre-wrap;font-size:13px;color:#333;background:#f5f5f5;padding:16px;border-radius:8px';
  pre.textContent = msg;
  document.body.replaceChildren(h2, pre);
};

window.addEventListener('error', (e) => {
  showError(`${e.message}\n\nFichier: ${e.filename}\nLigne: ${e.lineno}\n\n${e.error?.stack || ''}`);
});

window.addEventListener('unhandledrejection', (e) => {
  showError(`Promise rejetée:\n${e.reason?.message || e.reason}\n\n${e.reason?.stack || ''}`);
});

try {
  const root = document.getElementById('root')!;
  createRoot(root).render(<React.StrictMode><AppBourse /></React.StrictMode>);
} catch (e: any) {
  showError(`Crash au montage:\n${e?.message}\n\n${e?.stack}`);
}

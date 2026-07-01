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
//
// 2026-06-28 — Garde anti-boucle : si le localStorage.setItem échoue silencieusement
// (mode privé, quota plein, navigateur restrictif), la version stockée reste null
// et chaque reload re-déclenche la migration → BOUCLE INFINIE qui empêchait
// l'app de démarrer ("ça plane / ça vient et ça disparait"). On vérifie maintenant
// que la setItem a vraiment pris, sinon on bypass (l'app démarre quand même, juste
// avec le cache stale — moins grave que ne jamais démarrer).
// Compteur de tentatives en sessionStorage : si on a déjà retry 2 fois dans cette
// session, on bypass définitivement pour briser la boucle.
const BOURSE_APP_VERSION = 'v28-2026-07-01-14h';
(async () => {
  try {
    const lastVersion = localStorage.getItem('bourse_app_version');
    if (lastVersion === BOURSE_APP_VERSION) {
      return; // déjà migré
    }
    // Compteur de tentatives anti-boucle
    const attemptKey = '__bourse_killswitch_attempts__';
    const attempts = parseInt(sessionStorage.getItem(attemptKey) || '0', 10);
    if (attempts >= 2) {
      console.warn(
        '[Bourse] Kill-switch BYPASSED après 2 tentatives — localStorage probablement bloqué. L\'app démarre malgré le cache stale.',
      );
      return;
    }

    console.log(`[Bourse] Migration ${lastVersion} → ${BOURSE_APP_VERSION} (tentative ${attempts + 1}/2) : purge en cours…`);

    // Test précoce que localStorage est utilisable — sinon, on bypass tout
    // de suite pour éviter la boucle (rien ne sert d'unregister les SW si
    // on ne peut pas mémoriser qu'on a migré).
    try {
      localStorage.setItem(attemptKey + '_test', '1');
      localStorage.removeItem(attemptKey + '_test');
    } catch {
      console.warn('[Bourse] localStorage indisponible — kill-switch bypass.');
      return;
    }
    sessionStorage.setItem(attemptKey, String(attempts + 1));

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
    localStorage.removeItem('yukpo_guest_account');
    sessionStorage.clear();
    // Marquer la version + vérifier que ça a vraiment pris (sinon → bypass)
    localStorage.setItem('bourse_app_version', BOURSE_APP_VERSION);
    if (localStorage.getItem('bourse_app_version') !== BOURSE_APP_VERSION) {
      console.warn('[Bourse] localStorage.setItem n\'a pas pris — kill-switch bypass pour éviter boucle.');
      return; // démarrer l'app avec le cache stale plutôt que boucler
    }
    // Réécrire le compteur APRÈS le sessionStorage.clear() qui l'a effacé
    sessionStorage.setItem(attemptKey, String(attempts + 1));
    if (guestFlag && token) {
      localStorage.removeItem('token');
    }
    console.log('[Bourse] Purge terminée. Rechargement…');
    setTimeout(() => location.reload(), 100);
    return;
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

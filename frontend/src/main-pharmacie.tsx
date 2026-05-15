import React from 'react';
import { createRoot } from 'react-dom/client';
import AppPharmacie from './AppPharmacie';
import './i18n/i18nAutoDetector'; // ✅ détecte langue système (navigator.language) + persiste localStorage
import './index.css';

const showError = (msg: string) => {
  document.body.style.cssText = 'margin:0;padding:20px;font-family:monospace;background:#fff';
  document.body.innerHTML = `<h2 style="color:red">Erreur de démarrage</h2><pre style="white-space:pre-wrap;font-size:13px;color:#333;background:#f5f5f5;padding:16px;border-radius:8px">${msg}</pre>`;
};

window.addEventListener('error', (e) => {
  showError(`${e.message}\n\nFichier: ${e.filename}\nLigne: ${e.lineno}\n\n${e.error?.stack || ''}`);
});

window.addEventListener('unhandledrejection', (e) => {
  showError(`Promise rejetée:\n${e.reason?.message || e.reason}\n\n${e.reason?.stack || ''}`);
});

try {
  const root = document.getElementById('root')!;
  createRoot(root).render(<React.StrictMode><AppPharmacie /></React.StrictMode>);
} catch (e: any) {
  showError(`Crash au montage:\n${e?.message}\n\n${e?.stack}`);
}

// ✅ 2026-05-15 : enregistrement Service Worker pour notifications push
// persistantes/sonores côté pharmacien (workflow RFQ — 3 relances échelonnées
// sur 5 min). Le SW est dans /sw.js, partagé entre les apps lite (bourse,
// pharmacie, restaurant) — il gère push, notificationclick, et le cache PWA.
if ('serviceWorker' in navigator) {
  // Attendre le load complet pour ne pas concurrencer le rendu initial sur
  // les connexions lentes (4G dégradée CM).
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[pharmacie] SW enregistré, scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[pharmacie] SW non enregistré :', err);
      });
  });
}

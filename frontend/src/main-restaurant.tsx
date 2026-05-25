import React from 'react';
import { createRoot } from 'react-dom/client';
import AppRestaurant from './AppRestaurant';
import './i18n/i18nAutoDetector'; // ✅ détecte langue système (navigator.language) + persiste localStorage
import './index.css';

const showError = (msg: string) => {
  // ✅ 2026-05-16 — Pas d'innerHTML avec interpolation (anti-XSS au boot).
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
  createRoot(root).render(<React.StrictMode><AppRestaurant /></React.StrictMode>);
} catch (e: any) {
  showError(`Crash au montage:\n${e?.message}\n\n${e?.stack}`);
}

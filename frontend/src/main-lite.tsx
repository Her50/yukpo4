import React from 'react';
import { createRoot } from 'react-dom/client';
import AppLite from './AppLite';
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
  createRoot(root).render(
    <React.StrictMode>
      <AppLite />
    </React.StrictMode>
  );
} catch (e: any) {
  showError(`Crash au montage:\n${e?.message}\n\n${e?.stack}`);
}

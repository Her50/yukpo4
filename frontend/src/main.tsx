// src/main.tsx
import { MantineProvider } from '@mantine/core';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UserProvider } from './context/UserContext';
import "./i18n/i18nAutoDetector";
import './index.css'; // Styles globaux
import './utils/suppressWarnings';

// CORRECTION CRITIQUE: Importer la configuration axios avant tout
import './config/axios';

// ✅ 2026-05-15 — Capture le code parrain (?ref=XXX) dès le boot avant rendu.
import { captureRefFromUrl } from './utils/referralStorage';
captureRefFromUrl();

// Log pour confirmer que la nouvelle version se charge
console.log('[main] 🚀 Yukpo v2.1.4 - FORCE CACHE BUST ' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));
console.log('[main] 🔧 API Base URL configuré:', import.meta.env.VITE_API_BASE_URL || '(URLs relatives)');
// ✅ CORRIGÉ: Log les variables d'environnement chargées
console.log('[main] 🌐 API config:', import.meta.env.VITE_API_BASE_URL || '(utilise fallback)');
console.log('[main] 🌐 WebSocket config:', import.meta.env.VITE_WS_BASE_URL || '(utilise fallback)');


const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <MantineProvider>
        <UserProvider>
          <App />
        </UserProvider>
      </MantineProvider>
    </React.StrictMode>
  );
} else {
  console.error("❌ Élément #root introuvable !");
}

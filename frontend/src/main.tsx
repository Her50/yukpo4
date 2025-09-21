// src/main.tsx
import './utils/suppressWarnings';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Styles globaux
import "./i18n/i18nAutoDetector";
import { MantineProvider } from '@mantine/core';
import { UserProvider } from './context/UserContext';

// CORRECTION CRITIQUE: Importer la configuration axios avant tout
import './config/axios'

// Log pour confirmer que la nouvelle version se charge
console.log('[main] 🚀 Yukpomnang v2.1.0 - WebSockets HTTPS corrigés');
console.log('[main] 🔧 API Base URL configuré:', import.meta.env.VITE_API_BASE_URL || '(URLs relatives)');
console.log('[main] 🌐 WebSocket config:', window.location.hostname === 'localhost' ? 'ws://localhost:3001' : 'wss://yukpomnang.onrender.com');


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

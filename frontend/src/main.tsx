// src/main.tsx
import './utils/suppressWarnings';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Styles globaux
import "./i18n/i18nAutoDetector";
import { MantineProvider } from '@mantine/core';
import { UserProvider } from './context/UserContext';


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

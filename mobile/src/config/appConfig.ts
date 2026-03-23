import { config } from './environment';

/** Même base URL que `services/api.ts` — utilisé par écrans legacy (Login/Register) pour l’affichage debug */
export const APP_CONFIG = {
  API_BASE_URL: config.API_BASE_URL,
};

// Configuration de l'application mobile
export const appConfig = {
  // Version de l'application
  version: '1.0.0',

  // Configuration de l'API
  api: {
    baseUrl: config.API_BASE_URL,
    timeout: 30000,
    retries: 3
  },

  // Configuration de l'authentification
  auth: {
    tokenKey: 'auth_token',
    refreshTokenKey: 'refresh_token'
  },

  // Configuration du cache
  cache: {
    maxSize: 1000,
    defaultTTL: 24 * 60 * 60 * 1000 // 24 heures
  }
};

// Fonction de log sécurisée - MODE PRODUCTION FORCÉ
export const logGeneral = (message: string, data?: any) => {
  // Toujours logger en production pour diagnostiquer
  console.log(`[AppConfig] ${message}`, data);
};

// Fonction de log d'erreur - MODE PRODUCTION FORCÉ
export const logError = (message: string, error?: any) => {
  // Toujours logger les erreurs en production
  console.error(`[AppConfig] ${message}`, error);
};

// Fonction de log de debug - MODE PRODUCTION FORCÉ
export const logDebug = (message: string, data?: any) => {
  // Logger en production pour diagnostiquer
  console.debug(`[AppConfig] ${message}`, data);
};

export default appConfig;
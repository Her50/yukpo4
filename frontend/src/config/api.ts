/**
 * ⚠️ FICHIER OBSOLÈTE - Utiliser `api.config.ts` à la place
 * Ce fichier réexporte maintenant depuis api.config.ts pour compatibilité
 * 
 * ✅ MIGRATION: Tous les imports doivent pointer vers './api.config'
 */

// ✅ Réexporter depuis la nouvelle configuration centralisée
export {
  API_BASE_URL, API_ENDPOINTS, WS_BASE_URL, WS_ENDPOINTS, buildUrl, checkBackendHealth
} from './api.config';

// Fonction pour obtenir l'URL de l'API (compatibilité avec ancien code)
export const getApiBaseUrl = (): string => {
  const { API_BASE_URL } = require('./api.config');
  return API_BASE_URL;
};

// Garder FALLBACK_API_URL pour compatibilité
export const FALLBACK_API_URL = 'https://jsonplaceholder.typicode.com';

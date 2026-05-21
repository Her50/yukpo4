import axios from 'axios';
import { API_BASE_URL } from './api';

// Configuration globale d'axios
const configureAxios = () => {
  // Configuration de base
  axios.defaults.baseURL = API_BASE_URL;
  axios.defaults.timeout = 30000; // 30 secondes
  axios.defaults.maxContentLength = 200 * 1024 * 1024; // 200MB
  axios.defaults.maxBodyLength = 200 * 1024 * 1024; // 200MB

  // ✅ 2026-05-21 — withCredentials envoie automatiquement le cookie httpOnly
  // contenant le JWT. Indispensable pour la nouvelle auth web (fix XSS).
  // Le mobile RN n'utilise pas cette config (cookies pas pratiques en natif),
  // donc seul le frontend web bénéficie/dépend de withCredentials=true.
  axios.defaults.withCredentials = true;

  // ✅ 2026-05-21 — Wrapper global de window.fetch pour injecter automatiquement
  // `credentials: 'include'`. Sans cela, fetch() n'envoie PAS les cookies en
  // cross-origin → les 107 fichiers qui utilisent fetch() resteraient en
  // session anonyme. Cette modif rend la migration cookie httpOnly transparente
  // pour tout le code existant qui utilise fetch.
  if (typeof window !== 'undefined' && !(window as any).__yukpo_fetch_patched) {
    const origFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const next: RequestInit = { ...(init || {}) };
      // Ne pas écraser si l'appelant a explicitement choisi une autre valeur
      if (next.credentials === undefined) {
        next.credentials = 'include';
      }
      return origFetch(input, next);
    };
    (window as any).__yukpo_fetch_patched = true;
    console.log('[axios] ✅ window.fetch patché pour envoyer les cookies (credentials=include par défaut)');
  }

  // Headers par défaut
  axios.defaults.headers.common['Accept'] = 'application/json';
  axios.defaults.headers.post['Content-Type'] = 'application/json';

  // ✅ 2026-05-21 — Plus d'injection automatique du Bearer header.
  // Le cookie httpOnly (envoyé via withCredentials=true) suffit pour
  // l'authentification web. Le backend lit le cookie en fallback du Bearer.
  // Si un legacy stockage localStorage subsiste (transition), on l'envoie
  // tout de même comme Bearer pour ne pas casser d'éventuels chemins.
  axios.interceptors.request.use(
    (config) => {
      const legacyToken = localStorage.getItem('token');
      if (legacyToken && legacyToken !== 'null' && legacyToken !== 'undefined') {
        config.headers.Authorization = `Bearer ${legacyToken}`;
      }
      console.log(`[axios] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      return config;
    },
    (error) => {
      console.error('[axios] Erreur de requête:', error);
      return Promise.reject(error);
    }
  );

  // Intercepteur de réponse pour gérer les erreurs
  axios.interceptors.response.use(
    (response) => {
      console.log(`[axios] ✅ ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
      return response;
    },
    (error) => {
      if (error.response) {
        console.error(`[axios] ❌ ${error.response.status} ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
        
        // Gestion spéciale pour 401 (token expiré)
        if (error.response.status === 401) {
          console.warn('[axios] Token expiré, suppression du localStorage');
          localStorage.removeItem('token');
          // Optionnel: rediriger vers login
          // window.location.href = '/login';
        }
      } else if (error.request) {
        console.error('[axios] ❌ Pas de réponse du serveur:', error.request);
      } else {
        console.error('[axios] ❌ Erreur de configuration:', error.message);
      }
      
      return Promise.reject(error);
    }
  );

  console.log(`[axios] Configuration appliquée - Base URL: ${API_BASE_URL || '(relative URLs)'}`);
};

// Appliquer la configuration
configureAxios();

export default axios;
export { configureAxios }; 
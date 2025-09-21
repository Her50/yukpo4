import axios from 'axios';
import { API_BASE_URL } from './api';

// Configuration globale d'axios
const configureAxios = () => {
  // Configuration de base
  axios.defaults.baseURL = API_BASE_URL;
  axios.defaults.timeout = 30000; // 30 secondes
  axios.defaults.maxContentLength = 200 * 1024 * 1024; // 200MB
  axios.defaults.maxBodyLength = 200 * 1024 * 1024; // 200MB

  // Headers par défaut
  axios.defaults.headers.common['Accept'] = 'application/json';
  axios.defaults.headers.post['Content-Type'] = 'application/json';

  // Intercepteur de requête pour ajouter le token automatiquement
  axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Log pour debug
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
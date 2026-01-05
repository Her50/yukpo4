/**
 * Configuration centralisée des URLs API pour le Frontend (Vite)
 * 
 * Ce fichier centralise toutes les URLs pour éviter les hardcoding
 * et faciliter les changements d'environnement
 */

// ✅ Utiliser les variables d'environnement Vite
// Ces variables sont définies dans .env et chargées automatiquement par Vite

// Variables d'environnement depuis .env
const VITE_API_URL = import.meta.env.VITE_API_BASE_URL;
const VITE_WS_URL = import.meta.env.VITE_WS_BASE_URL;
const VITE_ENV = import.meta.env.VITE_ENVIRONMENT || 'production';

// ✅ Logique de détection intelligente:
// - En prod Netlify: utilise proxy (pas de CORS)
// - En dev/prod ailleurs: utilise URL directe
const isNetlify = typeof window !== 'undefined' && window.location.hostname.includes('netlify.app');

export const API_BASE_URL = VITE_API_URL || (isNetlify ? '' : 'https://yukpomnang.onrender.com');
export const WS_BASE_URL = VITE_WS_URL || 'wss://yukpomnang.onrender.com';

// Log pour vérifier la configuration chargée (seulement en développement)
if (import.meta.env.DEV) {
  console.log('📡 [Frontend API Config] API_BASE_URL:', API_BASE_URL);
  console.log('📡 [Frontend API Config] WS_BASE_URL:', WS_BASE_URL);
  console.log('📡 [Frontend API Config] Environment:', VITE_ENV);
  console.log('📡 [Frontend API Config] Is Netlify:', isNetlify);
}

// URLs API spécifiques
export const API_ENDPOINTS = {
  // Authentification
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
  },

  // Utilisateur
  USER: {
    ME: '/api/user/me',
    BALANCE: '/api/users/balance',
    CONSUMPTION_HISTORY: '/api/users/consumption-history',
    PAYMENT_HISTORY: '/api/users/payment-history',
    RECHARGE: '/api/users/recharge',
  },

  // Chat & Conversations
  CHAT: {
    CONVERSATIONS: '/api/chat/conversations',
    MESSAGES: (conversationId: string) => `/api/chat/messages/${conversationId}`,
    SEND_MESSAGE: '/api/chat/messages',
    NOTIFY_MESSAGE: '/api/chat/notify-message',
  },

  // Notifications
  NOTIFICATIONS: {
    USER_NOTIFICATIONS: (userId: string) => `/api/notifications/user/${userId}`,
    UNREAD_COUNT: (userId: string) => `/api/notifications/user/${userId}/unread-count`,
    MARK_READ: (notificationId: string) => `/api/notifications/${notificationId}/read`,
    MARK_ALL_READ: (userId: string) => `/api/notifications/user/${userId}/mark-all-read`,
    DELETE: (notificationId: string) => `/api/notifications/${notificationId}`,
  },

  // Services
  SERVICES: {
    LIST: '/api/services',
    DETAIL: (serviceId: number) => `/api/services/${serviceId}`,
    LAST: '/api/services/last',
    CREATE: '/api/services/create',
    PRESTATAIRE_SERVICES: '/api/prestataire/services',
    STATS: (serviceId: number) => `/api/services/${serviceId}/stats`,
    INTERACTIONS: (serviceId: number) => `/api/services/${serviceId}/interactions`,
    REVIEWS: (serviceId: number) => `/api/services/${serviceId}/reviews`,
    TOGGLE_STATUS: (serviceId: number) => `/api/services/${serviceId}/toggle-status`,
    DELETE: (serviceId: number) => `/api/services/${serviceId}/delete`,
  },

  // Reviews
  REVIEWS: {
    MARK_HELPFUL: (reviewId: number) => `/api/reviews/${reviewId}/helpful`,
  },

  // Géocodage
  GEOCODING: {
    REVERSE: '/api/geocoding/reverse',
  },

  // IA
  IA: {
    CREATION_SERVICE: '/api/ia/creation-service',
  },

  // WebRTC
  WEBRTC: {
    NOTIFY_CALL: '/api/webrtc/notify-call',
  },

  // Delivery Partners (Admin)
  DELIVERY_PARTNERS: '/api/delivery/partners',

  // Health check
  HEALTH: '/healthz',
};

// URLs WebSocket
export const WS_ENDPOINTS = {
  CHAT: (clientId: string | number) => `${WS_BASE_URL}/ws/chat/${clientId}`,
  NOTIFICATIONS: (userId: string | number) => `${WS_BASE_URL}/ws/notifications/${userId}`,
  STATUS: (userId: string | number) => `${WS_BASE_URL}/ws/status/${userId}`,
  PAYMENTS: (userId: string | number) => `${WS_BASE_URL}/ws/payments/${userId}`,
  DELIVERY_TRACKING: (deliveryId: string | number) => `${WS_BASE_URL}/delivery/${deliveryId}/ws`,
};

// Helper pour construire une URL complète
export const buildUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

// Fonction pour vérifier si le backend est accessible
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(buildUrl(API_ENDPOINTS.HEALTH), {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('[API Config] Backend non accessible:', error);
    return false;
  }
};

export default {
  API_BASE_URL,
  WS_BASE_URL,
  API_ENDPOINTS,
  WS_ENDPOINTS,
  buildUrl,
  checkBackendHealth,
};


/**
 * Configuration centralisée des URLs API
 * 
 * Ce fichier centralise toutes les URLs pour éviter les hardcoding
 * et faciliter les changements d'environnement
 */

// ✅ CORRIGÉ: Utiliser les variables d'environnement Expo
// Ces variables sont définies dans .env et chargées automatiquement par Expo

// Variables d'environnement depuis .env
// ✅ HARMONISÉ: Utiliser EXPO_PUBLIC_API_URL (comme dans eas.json)
const EXPO_API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL;
const EXPO_WS_URL = process.env.EXPO_PUBLIC_WS_URL;
const EXPO_ENV = process.env.EXPO_PUBLIC_ENVIRONMENT || 'production';

// ✅ Utiliser les variables d'environnement en priorité, avec fallback sécurisé
// ✅ 2026-02-14: Mise à jour pour utiliser le domaine Cloudflare api.yukpomnang.com
// Le DNS Cloudflare pointe automatiquement vers l'IP ECS actuelle (mise à jour automatique)
// HTTPS fourni automatiquement par Cloudflare
export const API_BASE_URL = EXPO_API_URL || 'https://api.yukpomnang.com';
export const WS_BASE_URL = EXPO_WS_URL || 'wss://api.yukpomnang.com';

// Log pour vérifier la configuration chargée (seulement en développement)
if (__DEV__) {
    console.log('📡 [API Config] API_BASE_URL:', API_BASE_URL);
    console.log('📡 [API Config] WS_BASE_URL:', WS_BASE_URL);
    console.log('📡 [API Config] Environment:', EXPO_ENV);
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
        STATS: (serviceId: number) => `/api/services/${serviceId}/stats`,
        INTERACTIONS: (serviceId: number) => `/api/services/${serviceId}/interactions`,
        REVIEWS: (serviceId: number) => `/api/services/${serviceId}/reviews`,
        SUBMIT_REVIEW: (serviceId: number) => `/api/services/${serviceId}/reviews`,
        // ✅ NOUVEAU 2025-01-01: Endpoints batch pour optimiser les performances
        BATCH_REVIEWS: '/api/services/batch/reviews',
        BATCH_STATS: '/api/services/batch/stats',
    },

    // Reviews
    REVIEWS: {
        MARK_HELPFUL: (reviewId: number) => `/api/reviews/${reviewId}/helpful`,
    },

    // WebRTC
    WEBRTC: {
        NOTIFY_CALL: '/api/webrtc/notify-call',
    },

    // Delivery Chat
    DELIVERY_CHAT: {
        MESSAGES: (deliveryId: string) => `/api/delivery/${deliveryId}/chat/messages`,
        SEND_MESSAGE: (deliveryId: string) => `/api/delivery/${deliveryId}/chat/send`,
    },
};

// URLs WebSocket
export const WS_ENDPOINTS = {
    CHAT: (serviceId: number, prestataireId: number, userId: number) =>
        `${WS_BASE_URL}/ws/chat/${serviceId}/${prestataireId}/${userId}`,
    WEBRTC: (callId: string) =>
        `${WS_BASE_URL}/ws/webrtc/${callId}`,
};

// Helper pour construire une URL complète
export const buildUrl = (endpoint: string): string => {
    return `${API_BASE_URL}${endpoint}`;
};

export default {
    API_BASE_URL,
    WS_BASE_URL,
    API_ENDPOINTS,
    WS_ENDPOINTS,
    buildUrl,
};


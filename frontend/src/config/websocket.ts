// ✅ CORRIGÉ: Utilise la configuration centralisée
import { WS_BASE_URL, WS_ENDPOINTS } from './api.config';

/**
 * ✅ 2026-05-16 — Auth WebSocket : injecte le JWT (depuis localStorage) en
 * query string `?token=...`. Les navigateurs n'envoient pas le header
 * `Authorization` lors d'un handshake WebSocket — la query string est la
 * convention universelle. Le backend la valide via `ws_auth.rs`.
 *
 * Idempotent : si l'URL contient déjà `?token=` ou `&token=`, on ne ré-ajoute
 * pas. Si le user n'est pas connecté (pas de jwt en localStorage), on
 * retourne l'URL telle quelle — le backend en mode strict refusera l'upgrade.
 */
export function withWsToken(url: string | null | undefined): string | null {
  if (!url) return null;
  // Idempotence
  if (/[?&]token=/.test(url)) return url;
  // Tente plusieurs clés localStorage (selon les pages, c'est 'jwt' ou 'token')
  let token: string | null = null;
  try {
    token = localStorage.getItem('jwt') || localStorage.getItem('token');
  } catch {
    // SSR / Private mode → pas de localStorage
    token = null;
  }
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

// Configuration WebSocket - ACTIVÉE ET OPTIMISÉE
export const WEBSOCKET_CONFIG = {
  // WebSockets activés avec correction HTTPS
  enabled: true,

  // ✅ URLs des WebSockets depuis configuration centralisée
  urls: {
    status: (userId: number) => {
      if (import.meta.env.DEV) {
        return `ws://localhost:3001/ws/status/${userId}`;
      }
      return WS_ENDPOINTS.STATUS(userId);
    },
    deliveryTracking: (deliveryId: string | number) => {
      if (import.meta.env.DEV) {
        return `ws://localhost:3001/delivery/${deliveryId}/ws`;
      }
      return WS_ENDPOINTS.DELIVERY_TRACKING(deliveryId);
    },
    notifications: (userId: number) => {
      if (import.meta.env.DEV) {
        return `ws://localhost:3001/ws/notifications/${userId}`;
      }
      return WS_ENDPOINTS.NOTIFICATIONS(userId);
    },
    chat: (clientId: string) => {
      if (import.meta.env.DEV) {
        return `ws://localhost:3001/ws/chat/${clientId}`;
      }
      return WS_ENDPOINTS.CHAT(clientId);
    },
    access: () => {
      if (import.meta.env.DEV) {
        return `ws://localhost:3001/ws/access`;
      }
      return `${WS_BASE_URL}/ws/access`;
    }
  },

  // Configuration de reconnexion optimisée
  reconnect: {
    enabled: true,
    interval: 3000,
    maxAttempts: 10,
    backoffMultiplier: 1.5
  },

  // Timeouts et gestion d'erreur
  timeouts: {
    connection: 10000,
    ping: 30000,
    pong: 5000
  },

  // Messages d'erreur personnalisés
  messages: {
    enabled: '✅ WebSockets activés - Fonctionnalités en temps réel disponibles',
    backendUnavailable: '⚠️ Serveur WebSocket non disponible - Vérifiez que le backend est en cours d\'exécution',
    connectionFailed: '❌ Échec de connexion WebSocket',
    reconnecting: '🔄 Reconnexion WebSocket en cours...',
    connected: '✅ WebSocket connecté',
    disconnected: '❌ WebSocket déconnecté'
  }
};

// Fonction utilitaire pour vérifier si les WebSockets sont activés
export const isWebSocketEnabled = () => WEBSOCKET_CONFIG.enabled;

// Fonction utilitaire pour obtenir l'URL d'un WebSocket.
// ✅ 2026-05-16 — Injecte automatiquement `?token=<jwt>` via withWsToken.
export const getWebSocketUrl = (type: keyof typeof WEBSOCKET_CONFIG.urls, ...params: (string | number)[]) => {
  if (!isWebSocketEnabled()) {
    return null;
  }

  const urlFn = WEBSOCKET_CONFIG.urls[type];
  let raw: string | null = null;
  if (typeof urlFn === 'function') {
    raw = (urlFn as Function)(...params);
  } else {
    raw = (urlFn as unknown as string) ?? null;
  }
  return withWsToken(raw);
};

// Types pour les messages WebSocket
export interface WebSocketMessage {
  message_type: string;
  user_id?: number;
  data?: any;
  timestamp?: string;
}

export interface ChatMessage {
  id: string;
  from: 'user' | 'prestataire' | 'system';
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'image' | 'audio' | 'file';
  fileUrl?: string;
  fileName?: string;
  serviceId?: string;
}

export interface Notification {
  id: string;
  type: 'message' | 'call' | 'service_update' | 'system';
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  timestamp: Date;
  read: boolean;
  serviceId?: string;
  serviceTitle?: string;
  actionUrl?: string;
}

// Configuration des événements WebSocket
export const WEBSOCKET_EVENTS = {
  // Événements de chat
  CHAT_MESSAGE: 'chat_message',
  CHAT_TYPING: 'chat_typing',
  CHAT_READ: 'chat_read',

  // Événements de notification
  NOTIFICATION_NEW: 'notification_new',
  NOTIFICATION_READ: 'notification_read',
  NOTIFICATION_DELETE: 'notification_delete',

  // Événements de statut
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  USER_TYPING: 'user_typing',
  DELIVERY_STATUS: 'delivery_status',
  DELIVERY_LOCATION: 'delivery_location',
  DELIVERY_PRICING: 'delivery_pricing',
  SHOPPING_STATUS: 'shopping_status',

  // Événements système
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
  RECONNECT: 'reconnect'
}; 
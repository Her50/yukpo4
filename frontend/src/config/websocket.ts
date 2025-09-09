// Configuration WebSocket - ACTIVÉE ET OPTIMISÉE
export const WEBSOCKET_CONFIG = {
  // WebSockets maintenant activés
  enabled: true,
  
  // URLs des WebSockets
  urls: {
    status: (userId: number) => `ws://${window.location.hostname}:3001/ws/status/${userId}`,
    notifications: (userId: number) => `ws://${window.location.hostname}:3001/ws/notifications/${userId}`,
    chat: (clientId: string) => `ws://${window.location.hostname}:3001/ws/chat/${clientId}`,
    access: `ws://${window.location.hostname}:3001/ws/access`
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

// Fonction utilitaire pour obtenir l'URL d'un WebSocket
export const getWebSocketUrl = (type: keyof typeof WEBSOCKET_CONFIG.urls, ...params: (string | number)[]) => {
  if (!isWebSocketEnabled()) {
    return null;
  }
  
  const urlFn = WEBSOCKET_CONFIG.urls[type];
  if (typeof urlFn === 'function') {
    return (urlFn as Function)(...params);
  }
  return urlFn;
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
  
  // Événements système
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
  RECONNECT: 'reconnect'
}; 
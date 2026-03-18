// Configuration WebSocket pour l'application mobile
// TODO: Fix TypeScript type issue
export const WEBSOCKET_CONFIG = {
  // WebSockets activés
  enabled: true,

  // URLs des WebSockets selon la plateforme
  urls: {
    // WebSocket pour les notifications
    notifications: (userId: string | number) => {
      // ✅ GCP Cloud Run (nouveau backend)
      const baseUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://yukpo-backend-yukpo-project.a.run.app';
      // ⚠️ AWS (ancien backend, commenté pour utilisation future)
      // const baseUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://api.yukpomnang.com';
      return `${baseUrl}/ws/notifications/${userId}`;
    },

    // WebSocket pour le chat
    chat: (clientId: string | number) => {
      // ✅ GCP Cloud Run (nouveau backend)
      const baseUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://yukpo-backend-yukpo-project.a.run.app';
      // ⚠️ AWS (ancien backend, commenté pour utilisation future)
      // const baseUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://api.yukpomnang.com';
      return `${baseUrl}/ws/chat/${clientId}`;
    },

    // WebSocket pour le statut des prestataires
    status: (userId: string | number) => {
      // ✅ GCP Cloud Run (nouveau backend)
      const baseUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://yukpo-backend-yukpo-project.a.run.app';
      // ⚠️ AWS (ancien backend, commenté pour utilisation future)
      // const baseUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://api.yukpomnang.com';
      return `${baseUrl}/ws/status/${userId}`;
    },

    // WebSocket pour les paiements
    payments: (userId: string | number) => {
      // ✅ GCP Cloud Run (nouveau backend)
      const baseUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://yukpo-backend-yukpo-project.a.run.app';
      // ⚠️ AWS (ancien backend, commenté pour utilisation future)
      // const baseUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://api.yukpomnang.com';
      return `${baseUrl}/ws/payments/${userId}`;
    }
  },

  // Configuration des reconnexions
  reconnect: {
    maxAttempts: 5,
    delay: 1000, // 1 seconde
    maxDelay: 30000, // 30 secondes
  },

  // Timeouts
  timeouts: {
    connection: 10000, // 10 secondes
    ping: 30000, // 30 secondes
    pong: 5000, // 5 secondes
  },

  // Messages de statut
  messages: {
    enabled: '✅ WebSockets activés - Fonctionnalités en temps réel disponibles',
    backendUnavailable: '⚠️ Serveur WebSocket non disponible - Vérifiez que le backend est en cours d\'exécution',
    connectionFailed: '❌ Échec de connexion WebSocket',
    reconnecting: '\uD83D\uDD04 Reconnexion WebSocket en cours...',
    connected: '✅ WebSocket connecté',
    disconnected: '❌ WebSocket déconnecté'
  }
};

// Fonction utilitaire pour vérifier si les WebSockets sont activés
export const isWebSocketEnabled = () => WEBSOCKET_CONFIG.enabled;

// Fonction utilitaire pour obtenir l'URL d'un WebSocket
export const getWebSocketUrl = (type: keyof typeof WEBSOCKET_CONFIG.urls, ...params: (string | number)[]) => {
  if (!isWebSocketEnabled()) {
    throw new Error('WebSockets are disabled');
  }

  const urlFn = WEBSOCKET_CONFIG.urls[type];
  if (typeof urlFn === 'function') {
    return urlFn(params[0] as string | number);
  }

  throw new Error(`Invalid WebSocket type: ${type}`);
};

// Types pour les messages WebSocket
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  userId?: string | number;
}

export interface NotificationMessage extends WebSocketMessage {
  type: 'notification';
  data: {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    action?: string;
    metadata?: any;
  };
}

export interface ChatMessage extends WebSocketMessage {
  type: 'chat';
  data: {
    id: string;
    senderId: string;
    receiverId: string;
    message: string;
    timestamp: number;
    type: 'text' | 'image' | 'file';
    metadata?: any;
  };
}

export interface StatusMessage extends WebSocketMessage {
  type: 'status';
  data: {
    userId: string;
    status: 'online' | 'offline' | 'busy' | 'away';
    lastSeen?: number;
  };
}

export interface PaymentMessage extends WebSocketMessage {
  type: 'payment';
  data: {
    paymentId: string;
    status: 'pending' | 'success' | 'failed' | 'cancelled';
    amount: number;
    currency: string;
    message: string;
  };
}

// Configuration des événements WebSocket
export const WEBSOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  MESSAGE: 'message',
  NOTIFICATION: 'notification',
  CHAT: 'chat',
  STATUS: 'status',
  PAYMENT: 'payment',
  PING: 'ping',
  PONG: 'pong',
} as const;

export type WebSocketEventType = typeof WEBSOCKET_EVENTS[keyof typeof WEBSOCKET_EVENTS];




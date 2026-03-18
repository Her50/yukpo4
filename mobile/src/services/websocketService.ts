import { Alert } from 'react-native';

import { WEBSOCKET_CONFIG } from '../config/websocket';
import {
  recordWebSocketError,
  recordWebSocketMessage,
  recordWebSocketReconnect,
  recordWebSocketStatusChange,
} from '../observability';

// Message WebSocket normalisé côté client (certains serveurs envoient `message_type`)
interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: string;
  // compat backend
  message_type?: string;
  user_id?: string | number;
}

interface WebSocketService {
  connect: (userId?: string | number) => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;
  isConnected: () => boolean;
  onMessage: (callback: (message: WebSocketMessage) => void) => void;
  onStatusChange: (callback: (status: 'online' | 'offline') => void) => void;
}

class WebSocketManager implements WebSocketService {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private messageCallbacks: ((message: WebSocketMessage) => void)[] = [];
  private statusCallbacks: ((status: 'online' | 'offline') => void)[] = [];
  private isConnecting = false;
  private connectStartedAt: number | null = null;
  private currentUserId: string | number | null = null;

  constructor() {
    // URL sera construite dynamiquement lors de la connexion
  }

  connect(userId?: string | number): void {
    if (!userId) {
      // ✅ CORRIGÉ: Ne pas logger d'erreur si userId n'est pas encore disponible (chargement auth)
      // Juste ignorer silencieusement, la connexion sera réessayée quand userId sera disponible
      return;
    }

    if (this.isConnecting || this.isConnected()) {
      // Si déjà connecté avec le même userId, ne rien faire
      if (this.currentUserId === userId) {
        return;
      }
      // Si connecté avec un autre userId, déconnecter d'abord
      this.disconnect();
    }

    // Construire l'URL complète avec le chemin WebSocket
    this.currentUserId = userId;
    this.url = WEBSOCKET_CONFIG.urls.notifications(userId);
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    this.isConnecting = true;
    console.log(`\uD83D\uDD0C [WebSocket] Tentative de connexion à ${this.url}...`);

    this.connectStartedAt = Date.now();

    try {
      if (!this.url) {
        throw new Error('URL WebSocket non définie');
      }
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('✅ [WebSocket] Connexion établie');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        const duration = this.connectStartedAt ? Date.now() - this.connectStartedAt : undefined;
        recordWebSocketStatusChange('online', duration ? { durationMs: duration } : undefined);
        this.notifyStatusChange('online');
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          // ✅ Normaliser les payloads backend: `message_type` -> `type`
          const message: WebSocketMessage = {
            ...raw,
            type: raw?.type || raw?.message_type || 'unknown',
          };
          console.log('\uD83D\uDCE8 [WebSocket] Message reçu:', message.type);
          recordWebSocketMessage(message.type);
          this.messageCallbacks.forEach(callback => callback(message));
        } catch (error) {
          console.error('❌ [WebSocket] Erreur parsing message:', error);
          recordWebSocketError(error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('\uD83D\uDD0C [WebSocket] Connexion fermée:', event.code, event.reason);
        this.isConnecting = false;
        recordWebSocketStatusChange('offline');
        this.notifyStatusChange('offline');

        // Reconnexion automatique si la fermeture n'était pas propre
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        // ✅ AMÉLIORÉ: Extraire des informations utiles de l'événement d'erreur
        const errorInfo = error && typeof error === 'object' 
          ? {
              message: (error as any).message || null,
              type: (error as any).type || null,
              isTrusted: (error as any).isTrusted !== undefined ? (error as any).isTrusted : null,
              url: this.url || null,
            }
          : { error, url: this.url || null };
        
        // Ne logger que si on a des informations utiles
        if (errorInfo.message || errorInfo.type || errorInfo.url) {
          console.error('❌ [WebSocket] Erreur:', errorInfo);
        } else {
          // Si l'erreur n'a pas d'informations utiles, logger juste l'URL et le statut
          console.warn('⚠️ [WebSocket] Erreur de connexion (détails non disponibles) - URL:', this.url);
        }
        
        this.isConnecting = false;
        recordWebSocketError(error);
        this.notifyStatusChange('offline');
      };

    } catch (error) {
      console.error('❌ [WebSocket] Erreur de connexion:', error);
      this.isConnecting = false;
      this.notifyStatusChange('offline');
    }
  }

  disconnect(): void {
    if (this.ws) {
      console.log('\uD83D\uDD0C [WebSocket] Déconnexion...');
      this.ws.close(1000, 'Déconnexion volontaire');
      this.ws = null;
    }
    this.currentUserId = null;
    this.url = null;
  }

  sendMessage(message: any): void {
    if (this.isConnected()) {
      try {
        const messageStr = JSON.stringify({
          ...message,
          timestamp: new Date().toISOString()
        });
        this.ws!.send(messageStr);
        console.log('\uD83D\uDCE4 [WebSocket] Message envoyé:', message.type);
      } catch (error) {
        console.error('❌ [WebSocket] Erreur envoi message:', error);
      }
    } else {
      console.warn('⚠️ [WebSocket] Impossible d\'envoyer le message - non connecté');
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  onMessage(callback: (message: WebSocketMessage) => void): () => void {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
    };
  }

  onStatusChange(callback: (status: 'online' | 'offline') => void): () => void {
    this.statusCallbacks.push(callback);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`\uD83D\uDD04 [WebSocket] Reconnexion dans ${delay}ms (tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    recordWebSocketReconnect(this.reconnectAttempts, delay);

    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        // ✅ IMPORTANT: conserver le userId pour reconstruire l'URL
        this.connect(this.currentUserId ?? undefined);
      } else {
        console.error('❌ [WebSocket] Nombre maximum de tentatives de reconnexion atteint');
        Alert.alert(
          'Connexion perdue',
          'Impossible de se reconnecter au serveur. Vérifiez votre connexion internet.'
        );
      }
    }, delay);
  }

  private notifyStatusChange(status: 'online' | 'offline'): void {
    this.statusCallbacks.forEach(callback => callback(status));
  }
}

// Instance singleton du service WebSocket
const websocketService = new WebSocketManager();

export default websocketService;

// Types et interfaces pour l'utilisation
export interface UserStatusUpdate {
  type: 'user_status';
  data: {
    user_id: string;
    status: 'online' | 'offline';
    last_seen: string;
  };
}

export interface ChatMessage {
  type: 'chat_message';
  data: {
    id: string;
    service_id: string;
    sender_id: string;
    content: string;
    timestamp: string;
  };
}

export interface NotificationMessage {
  type: 'notification';
  data: {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    timestamp: string;
  };
}



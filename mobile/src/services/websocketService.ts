import { Alert } from 'react-native';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface WebSocketService {
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;
  isConnected: () => boolean;
  onMessage: (callback: (message: WebSocketMessage) => void) => void;
  onStatusChange: (callback: (status: 'online' | 'offline') => void) => void;
}

class WebSocketManager implements WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private messageCallbacks: ((message: WebSocketMessage) => void)[] = [];
  private statusCallbacks: ((status: 'online' | 'offline') => void)[] = [];
  private isConnecting = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    this.isConnecting = true;
    console.log('🔌 [WebSocket] Tentative de connexion...');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('✅ [WebSocket] Connexion établie');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.notifyStatusChange('online');
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 [WebSocket] Message reçu:', message.type);
          this.messageCallbacks.forEach(callback => callback(message));
        } catch (error) {
          console.error('❌ [WebSocket] Erreur parsing message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔌 [WebSocket] Connexion fermée:', event.code, event.reason);
        this.isConnecting = false;
        this.notifyStatusChange('offline');

        // Reconnexion automatique si la fermeture n'était pas propre
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ [WebSocket] Erreur:', error);
        this.isConnecting = false;
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
      console.log('🔌 [WebSocket] Déconnexion...');
      this.ws.close(1000, 'Déconnexion volontaire');
      this.ws = null;
    }
  }

  sendMessage(message: any): void {
    if (this.isConnected()) {
      try {
        const messageStr = JSON.stringify({
          ...message,
          timestamp: new Date().toISOString()
        });
        this.ws!.send(messageStr);
        console.log('📤 [WebSocket] Message envoyé:', message.type);
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

  onMessage(callback: (message: WebSocketMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  onStatusChange(callback: (status: 'online' | 'offline') => void): void {
    this.statusCallbacks.push(callback);
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`🔄 [WebSocket] Reconnexion dans ${delay}ms (tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect();
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
const wsUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://yukpomnang.onrender.com';
const websocketService = new WebSocketManager(wsUrl);

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



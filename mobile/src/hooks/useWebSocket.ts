import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { 
  getWebSocketUrl, 
  isWebSocketEnabled, 
  WEBSOCKET_CONFIG, 
  WEBSOCKET_EVENTS,
  WebSocketMessage,
  NotificationMessage,
  ChatMessage,
  StatusMessage,
  PaymentMessage
} from '../config/websocket';

// Hook pour gérer les notifications WebSocket
export const useNotificationsWebSocket = (userId: string | number) => {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const appState = useRef(AppState.currentState);

  const connect = useCallback(() => {
    if (!isWebSocketEnabled() || !userId) {
      console.log('WebSocket désactivé ou userId manquant');
      return;
    }

    try {
      const wsUrl = getWebSocketUrl('notifications', userId);
      console.log('Connexion WebSocket notifications:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket notifications connecté');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'notification') {
            const notification = message as NotificationMessage;
            setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Garder les 50 dernières
          }
        } catch (err) {
          console.error('Erreur parsing message WebSocket:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket notifications déconnecté');
        setIsConnected(false);
        
        // Reconnexion automatique si l'app est active
        if (appState.current === 'active' && reconnectAttempts.current < WEBSOCKET_CONFIG.reconnect.maxAttempts) {
          const delay = Math.min(
            WEBSOCKET_CONFIG.reconnect.delay * Math.pow(2, reconnectAttempts.current),
            WEBSOCKET_CONFIG.reconnect.maxDelay
          );
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('Erreur WebSocket notifications:', error);
        setError('Erreur de connexion WebSocket');
      };

    } catch (err) {
      console.error('Erreur création WebSocket:', err);
      setError('Impossible de créer la connexion WebSocket');
    }
  }, [userId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  // Gestion du cycle de vie de l'app
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App devient active, reconnecter
        connect();
      } else if (nextAppState.match(/inactive|background/)) {
        // App devient inactive, déconnecter
        disconnect();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Connexion initiale
    connect();

    return () => {
      subscription?.remove();
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    notifications,
    error,
    connect,
    disconnect,
    clearNotifications: () => setNotifications([])
  };
};

// Hook pour gérer le statut des prestataires
export const usePrestataireStatus = (userId: string | number) => {
  const [isConnected, setIsConnected] = useState(false);
  const [prestataireStatus, setPrestataireStatus] = useState<Map<string, StatusMessage['data']>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!isWebSocketEnabled() || !userId) {
      console.log('WebSocket désactivé ou userId manquant');
      return;
    }

    try {
      const wsUrl = getWebSocketUrl('status', userId);
      console.log('Connexion WebSocket status:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket status connecté');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'status') {
            const statusMessage = message as StatusMessage;
            setPrestataireStatus(prev => {
              const newMap = new Map(prev);
              newMap.set(statusMessage.data.userId, statusMessage.data);
              return newMap;
            });
          }
        } catch (err) {
          console.error('Erreur parsing message WebSocket status:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket status déconnecté');
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('Erreur WebSocket status:', error);
        setError('Erreur de connexion WebSocket status');
      };

    } catch (err) {
      console.error('Erreur création WebSocket status:', err);
      setError('Impossible de créer la connexion WebSocket status');
    }
  }, [userId]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    prestataireStatus,
    error,
    connect,
    disconnect,
    getPrestataireStatus: (prestataireId: string) => prestataireStatus.get(prestataireId)
  };
};

// Hook pour gérer les notifications de paiement
export const usePaymentWebSocket = (userId: string | number) => {
  const [isConnected, setIsConnected] = useState(false);
  const [paymentUpdates, setPaymentUpdates] = useState<PaymentMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!isWebSocketEnabled() || !userId) {
      console.log('WebSocket désactivé ou userId manquant');
      return;
    }

    try {
      const wsUrl = getWebSocketUrl('payments', userId);
      console.log('Connexion WebSocket payments:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket payments connecté');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'payment') {
            const paymentMessage = message as PaymentMessage;
            setPaymentUpdates(prev => [paymentMessage, ...prev.slice(0, 19)]); // Garder les 20 dernières
          }
        } catch (err) {
          console.error('Erreur parsing message WebSocket payments:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket payments déconnecté');
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('Erreur WebSocket payments:', error);
        setError('Erreur de connexion WebSocket payments');
      };

    } catch (err) {
      console.error('Erreur création WebSocket payments:', err);
      setError('Impossible de créer la connexion WebSocket payments');
    }
  }, [userId]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    paymentUpdates,
    error,
    connect,
    disconnect,
    clearPaymentUpdates: () => setPaymentUpdates([])
  };
};

// Hook générique pour WebSocket
export const useWebSocket = (type: 'notifications' | 'chat' | 'status' | 'payments', userId: string | number) => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!isWebSocketEnabled() || !userId) {
      console.log('WebSocket désactivé ou userId manquant');
      return;
    }

    try {
      const wsUrl = getWebSocketUrl(type, userId);
      console.log(`Connexion WebSocket ${type}:`, wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`WebSocket ${type} connecté`);
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setMessages(prev => [message, ...prev.slice(0, 99)]); // Garder les 100 dernières
        } catch (err) {
          console.error(`Erreur parsing message WebSocket ${type}:`, err);
        }
      };

      ws.onclose = () => {
        console.log(`WebSocket ${type} déconnecté`);
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error(`Erreur WebSocket ${type}:`, error);
        setError(`Erreur de connexion WebSocket ${type}`);
      };

    } catch (err) {
      console.error(`Erreur création WebSocket ${type}:`, err);
      setError(`Impossible de créer la connexion WebSocket ${type}`);
    }
  }, [type, userId]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    messages,
    error,
    connect,
    disconnect,
    sendMessage,
    clearMessages: () => setMessages([])
  };
};

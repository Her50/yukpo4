import { useCallback, useEffect, useState } from 'react';
import websocketService, { ChatMessage, NotificationMessage, UserStatusUpdate } from '../services/websocketService';

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  lastError: string | null;
}

interface WebSocketActions {
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;
  sendChatMessage: (serviceId: string, content: string) => void;
  sendUserStatus: (status: 'online' | 'offline') => void;
}

interface WebSocketCallbacks {
  onUserStatusUpdate?: (update: UserStatusUpdate) => void;
  onChatMessage?: (message: ChatMessage) => void;
  onNotification?: (notification: NotificationMessage) => void;
  onConnectionChange?: (isConnected: boolean) => void;
}

/**
 * Hook pour gérer la connexion WebSocket et les messages en temps réel
 * Fournit une interface simple pour interagir avec le service WebSocket
 */
export const useWebSocket = (
  userId?: string,
  callbacks?: WebSocketCallbacks
): WebSocketState & WebSocketActions => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Gérer les changements de statut de connexion
  useEffect(() => {
    const handleStatusChange = (status: 'online' | 'offline') => {
      setIsConnected(status === 'online');
      setIsConnecting(false);
      setLastError(null);

      if (status === 'offline') {
        setLastError('Connexion perdue');
      }

      callbacks?.onConnectionChange?.(status === 'online');
    };

    websocketService.onStatusChange(handleStatusChange);

    return () => {
      // Nettoyage des callbacks si nécessaire
    };
  }, [callbacks]);

  // Gérer les messages WebSocket
  useEffect(() => {
    const handleMessage = (message: any) => {
      console.log('📨 [useWebSocket] Message reçu:', message.type);

      switch (message.type) {
        case 'user_status':
          callbacks?.onUserStatusUpdate?.(message as UserStatusUpdate);
          break;

        case 'chat_message':
          callbacks?.onChatMessage?.(message as ChatMessage);
          break;

        case 'notification':
          callbacks?.onNotification?.(message as NotificationMessage);
          break;

        default:
          console.log('📨 [useWebSocket] Type de message non géré:', message.type);
      }
    };

    websocketService.onMessage(handleMessage);
  }, [callbacks]);

  // Se connecter automatiquement si un userId est fourni
  useEffect(() => {
    if (userId && !isConnected && !isConnecting) {
      if (typeof connect === 'function') {
        try {
          connect();
        } catch (error) {
          console.warn('[useWebSocket] Erreur lors de la connexion automatique:', error);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isConnected, isConnecting]); // ✅ CORRIGÉ: connect est stable (useCallback), mais on inclut les dépendances nécessaires

  const connect = useCallback(() => {
    if (!isConnected && !isConnecting) {
      if (!userId) {
        console.warn('⚠️ [useWebSocket] userId requis pour la connexion');
        setLastError('userId requis');
        return;
      }
      setIsConnecting(true);
      setLastError(null);
      websocketService.connect(userId);
    }
  }, [isConnected, isConnecting, userId]);

  const disconnect = useCallback(() => {
    websocketService.disconnect();
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (isConnected) {
      websocketService.sendMessage(message);
    } else {
      console.warn('⚠️ [useWebSocket] Impossible d\'envoyer le message - non connecté');
      setLastError('Non connecté au serveur');
    }
  }, [isConnected]);

  const sendChatMessage = useCallback((serviceId: string, content: string) => {
    if (!userId) {
      console.warn('⚠️ [useWebSocket] userId requis pour envoyer un message de chat');
      return;
    }

    sendMessage({
      type: 'chat_message',
      data: {
        service_id: serviceId,
        sender_id: userId,
        content: content,
        timestamp: new Date().toISOString()
      }
    });
  }, [userId, sendMessage]);

  const sendUserStatus = useCallback((status: 'online' | 'offline') => {
    if (!userId) {
      console.warn('⚠️ [useWebSocket] userId requis pour envoyer le statut');
      return;
    }

    sendMessage({
      type: 'user_status',
      data: {
        user_id: userId,
        status: status,
        last_seen: new Date().toISOString()
      }
    });
  }, [userId, sendMessage]);

  return {
    isConnected,
    isConnecting,
    lastError,
    connect,
    disconnect,
    sendMessage,
    sendChatMessage,
    sendUserStatus
  };
};

export default useWebSocket;
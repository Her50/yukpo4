import { useCallback, useEffect, useState } from 'react';
import websocketService, { ChatMessage, NotificationMessage, UserStatusUpdate } from '../services/websocketService';

// ✅ PATCH CRITIQUE: Wrapper pour garantir que les fonctions de cleanup sont toujours valides
const safeCleanup = (cleanup: any): (() => void) | undefined => {
  if (cleanup === null || cleanup === undefined) {
    return undefined;
  }
  if (typeof cleanup === 'function') {
    return () => {
      try {
        cleanup();
      } catch (error) {
        console.error('[safeCleanup] Erreur dans cleanup:', error);
      }
    };
  }
  console.error('[safeCleanup] ⚠️ Cleanup non-fonction détecté:', typeof cleanup, cleanup);
  return undefined;
};

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

  // ✅ CORRIGÉ: Déclarer les fonctions AVANT les useEffect qui les utilisent
  const connect = useCallback(() => {
    if (!isConnected && !isConnecting) {
      if (!userId) {
        // ✅ CORRIGÉ: Ne pas logger d'erreur si userId n'est pas encore disponible (chargement auth)
        // Juste ignorer silencieusement, la connexion sera réessayée quand userId sera disponible
        return;
      }
      setIsConnecting(true);
      setLastError(null);
      if (websocketService && typeof websocketService.connect === 'function') {
        websocketService.connect(userId);
      }
    }
  }, [isConnected, isConnecting, userId]);

  const disconnect = useCallback(() => {
    if (websocketService && typeof websocketService.disconnect === 'function') {
      websocketService.disconnect();
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (isConnected && websocketService && typeof websocketService.sendMessage === 'function') {
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

  // Gérer les changements de statut de connexion
  useEffect(() => {
    // ✅ SÉCURITÉ: Vérifier que websocketService existe
    if (!websocketService || typeof websocketService.onStatusChange !== 'function') {
      console.warn('[useWebSocket] websocketService.onStatusChange non disponible');
      // ✅ CORRIGÉ: Retourner une fonction vide au lieu de undefined
      return () => { };
    }

    const handleStatusChange = (status: 'online' | 'offline') => {
      setIsConnected(status === 'online');
      setIsConnecting(false);
      setLastError(null);

      if (status === 'offline') {
        setLastError('Connexion perdue');
      }

      callbacks?.onConnectionChange?.(status === 'online');
    };

    // ✅ CORRIGÉ: Stocker et retourner la fonction de cleanup
    const unsubscribe = websocketService.onStatusChange(handleStatusChange);

    // ✅ PATCH CRITIQUE: Utiliser safeCleanup pour garantir une fonction valide
    return safeCleanup(unsubscribe);
  }, [callbacks]);

  // Gérer les messages WebSocket
  useEffect(() => {
    // ✅ SÉCURITÉ: Vérifier que websocketService existe
    if (!websocketService || typeof websocketService.onMessage !== 'function') {
      console.warn('[useWebSocket] websocketService.onMessage non disponible');
      // ✅ CORRIGÉ: Retourner une fonction vide au lieu de undefined
      return () => { };
    }

    const handleMessage = (message: any) => {
      console.log('\uD83D\uDCE8 [useWebSocket] Message reçu:', message.type);

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
          console.log('\uD83D\uDCE8 [useWebSocket] Type de message non géré:', message.type);
      }
    };

    // ✅ CORRIGÉ: Stocker et retourner la fonction de cleanup
    const unsubscribe = websocketService.onMessage(handleMessage);

    // ✅ PATCH CRITIQUE: Utiliser safeCleanup pour garantir une fonction valide
    return safeCleanup(unsubscribe);
  }, [callbacks]);

  // Se connecter automatiquement si un userId est fourni
  useEffect(() => {
    if (userId && !isConnected && !isConnecting) {
      try {
        connect();
      } catch (error) {
        console.warn('[useWebSocket] Erreur lors de la connexion automatique:', error);
      }
    }
    // ✅ CORRIGÉ: Ne pas retourner undefined explicitement - React gère cela automatiquement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isConnected, isConnecting, connect]); // ✅ CORRIGÉ: Inclure connect dans les dépendances

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
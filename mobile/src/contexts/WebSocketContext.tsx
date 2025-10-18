// @ts-nocheck
/**
 * Contexte WebSocket Global pour les notifications en temps réel
 * Gère la connexion WebSocket persistante et les notifications push
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import websocketService, { ChatMessage, NotificationMessage, UserStatusUpdate } from '../services/websocketService';
import { useAuth } from './AuthContext';

interface WebSocketContextValue {
    isConnected: boolean;
    onlineUsers: Set<string>;
    unreadChats: Map<string, number>;
    sendMessage: (message: any) => void;
    registerNotificationHandler: (handler: (notification: NotificationMessage) => void) => () => void;
    registerChatMessageHandler: (handler: (message: ChatMessage) => void) => () => void;
    registerUserStatusHandler: (handler: (update: UserStatusUpdate) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [unreadChats, setUnreadChats] = useState<Map<string, number>>(new Map());

    // Handlers pour différents types de messages
    const [notificationHandlers, setNotificationHandlers] = useState<((notification: NotificationMessage) => void)[]>([]);
    const [chatMessageHandlers, setChatMessageHandlers] = useState<((message: ChatMessage) => void)[]>([]);
    const [userStatusHandlers, setUserStatusHandlers] = useState<((update: UserStatusUpdate) => void)[]>([]);

    // Se connecter au WebSocket quand l'utilisateur est connecté
    useEffect(() => {
        if (user?.id) {
            console.log('[WebSocketContext] 🔌 Connexion WebSocket pour user:', user.id);
            websocketService.connect();

            // Envoyer le statut en ligne
            setTimeout(() => {
                if (websocketService.isConnected()) {
                    websocketService.sendMessage({
                        type: 'user_status',
                        data: {
                            user_id: user.id,
                            status: 'online',
                            last_seen: new Date().toISOString()
                        }
                    });
                }
            }, 1000);
        }

        return () => {
            if (user?.id) {
                // Envoyer le statut hors ligne avant de se déconnecter
                if (websocketService.isConnected()) {
                    websocketService.sendMessage({
                        type: 'user_status',
                        data: {
                            user_id: user.id,
                            status: 'offline',
                            last_seen: new Date().toISOString()
                        }
                    });
                }
                console.log('[WebSocketContext] 🔌 Déconnexion WebSocket');
                websocketService.disconnect();
            }
        };
    }, [user?.id]);

    // Gérer les changements de statut de connexion
    useEffect(() => {
        const handleStatusChange = (status: 'online' | 'offline') => {
            console.log('[WebSocketContext] 📡 Statut connexion:', status);
            setIsConnected(status === 'online');

            if (status === 'online' && user?.id) {
                // Renvoyer le statut utilisateur après reconnexion
                websocketService.sendMessage({
                    type: 'user_status',
                    data: {
                        user_id: user.id,
                        status: 'online',
                        last_seen: new Date().toISOString()
                    }
                });
            }
        };

        websocketService.onStatusChange(handleStatusChange);
    }, [user?.id]);

    // Gérer les messages WebSocket
    useEffect(() => {
        const handleMessage = (message: any) => {
            console.log('[WebSocketContext] 📨 Message reçu:', message.type);

            switch (message.type) {
                case 'notification':
                    // Afficher une notification locale
                    const notification = message as NotificationMessage;
                    console.log('[WebSocketContext] 🔔 Notification:', notification.data.title);

                    // Notifier tous les handlers enregistrés
                    notificationHandlers.forEach(handler => handler(notification));

                    // Afficher une alerte si l'app est au premier plan
                    if (notification.data.priority === 'high') {
                        Alert.alert(
                            notification.data.title,
                            notification.data.message,
                            [{ text: 'OK' }]
                        );
                    }
                    break;

                case 'chat_message':
                    const chatMessage = message as ChatMessage;
                    console.log('[WebSocketContext] 💬 Message chat:', chatMessage.data.service_id);

                    // Notifier tous les handlers enregistrés
                    chatMessageHandlers.forEach(handler => handler(chatMessage));

                    // Incrémenter le compteur de messages non lus
                    setUnreadChats(prev => {
                        const newMap = new Map(prev);
                        const serviceId = chatMessage.data.service_id;
                        newMap.set(serviceId, (newMap.get(serviceId) || 0) + 1);
                        return newMap;
                    });
                    break;

                case 'user_status':
                    const statusUpdate = message as UserStatusUpdate;
                    console.log('[WebSocketContext] 👤 Statut utilisateur:', statusUpdate.data.user_id, statusUpdate.data.status);

                    // Notifier tous les handlers enregistrés
                    userStatusHandlers.forEach(handler => handler(statusUpdate));

                    // Mettre à jour la liste des utilisateurs en ligne
                    setOnlineUsers(prev => {
                        const newSet = new Set(prev);
                        if (statusUpdate.data.status === 'online') {
                            newSet.add(statusUpdate.data.user_id);
                        } else {
                            newSet.delete(statusUpdate.data.user_id);
                        }
                        return newSet;
                    });
                    break;

                case 'call_incoming':
                    // Notification d'appel entrant
                    console.log('[WebSocketContext] 📞 Appel entrant:', message.data);
                    Alert.alert(
                        'Appel entrant',
                        `${message.data.caller_name || 'Un utilisateur'} vous appelle`,
                        [
                            { text: 'Refuser', style: 'cancel' },
                            {
                                text: 'Répondre', onPress: () => {
                                    // TODO: Ouvrir le modal d'appel
                                    console.log('[WebSocketContext] Répondre à l\'appel:', message.data.call_id);
                                }
                            }
                        ]
                    );
                    break;

                default:
                    console.log('[WebSocketContext] ❓ Type de message non géré:', message.type);
            }
        };

        websocketService.onMessage(handleMessage);
    }, [notificationHandlers, chatMessageHandlers, userStatusHandlers]);

    // Fonction pour envoyer un message
    const sendMessage = useCallback((message: any) => {
        if (isConnected) {
            websocketService.sendMessage(message);
        } else {
            console.warn('[WebSocketContext] ⚠️ Impossible d\'envoyer le message - non connecté');
        }
    }, [isConnected]);

    // Enregistrer des handlers personnalisés
    const registerNotificationHandler = useCallback((handler: (notification: NotificationMessage) => void) => {
        setNotificationHandlers(prev => [...prev, handler]);

        // Retourner une fonction de nettoyage
        return () => {
            setNotificationHandlers(prev => prev.filter(h => h !== handler));
        };
    }, []);

    const registerChatMessageHandler = useCallback((handler: (message: ChatMessage) => void) => {
        setChatMessageHandlers(prev => [...prev, handler]);

        return () => {
            setChatMessageHandlers(prev => prev.filter(h => h !== handler));
        };
    }, []);

    const registerUserStatusHandler = useCallback((handler: (update: UserStatusUpdate) => void) => {
        setUserStatusHandlers(prev => [...prev, handler]);

        return () => {
            setUserStatusHandlers(prev => prev.filter(h => h !== handler));
        };
    }, []);

    const value: WebSocketContextValue = {
        isConnected,
        onlineUsers,
        unreadChats,
        sendMessage,
        registerNotificationHandler,
        registerChatMessageHandler,
        registerUserStatusHandler
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocketContext = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocketContext doit être utilisé dans un WebSocketProvider');
    }
    return context;
};

export default WebSocketContext;


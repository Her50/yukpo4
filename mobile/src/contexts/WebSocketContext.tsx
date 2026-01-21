/**
 * Contexte WebSocket Global pour les notifications en temps réel
 * Gère la connexion WebSocket persistante et les notifications push
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import websocketService, { ChatMessage, NotificationMessage, UserStatusUpdate } from '../services/websocketService';
import { useAuth } from './AuthContext';

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
        if (!user?.id) {
            // ✅ CORRIGÉ: Retourner une fonction vide au lieu de undefined
            return () => { };
        }

        // ✅ SÉCURITÉ: Vérifier que websocketService existe
        if (!websocketService || typeof websocketService.connect !== 'function') {
            console.warn('[WebSocketContext] websocketService.connect non disponible');
            // ✅ CORRIGÉ: Retourner une fonction vide au lieu de undefined
            return () => { };
        }

        console.log('[WebSocketContext] 🔌 Connexion WebSocket pour user:', user.id);

        // DÉLAI AUGMENTÉ pour éviter les blocages au démarrage
        const connectTimer = setTimeout(() => {
            try {
                if (websocketService && typeof websocketService.connect === 'function') {
                    websocketService.connect(user.id);
                }
            } catch (error) {
                console.error('[WebSocketContext] Erreur connexion WebSocket:', error);
            }
        }, 2000); // Délai réduit à 2s

        // Envoyer le statut en ligne
        const statusTimer = setTimeout(() => {
            if (websocketService && typeof websocketService.isConnected === 'function' && websocketService.isConnected()) {
                if (typeof websocketService.sendMessage === 'function') {
                    websocketService.sendMessage({
                        type: 'user_status',
                        data: {
                            user_id: user.id,
                            status: 'online',
                            last_seen: new Date().toISOString()
                        }
                    });
                }
            }
        }, 3000); // Délai réduit à 3s

        return () => {
            // ✅ NETTOYAGE: Annuler les timers
            clearTimeout(connectTimer);
            clearTimeout(statusTimer);

            if (user?.id) {
                // Envoyer le statut hors ligne avant de se déconnecter
                if (websocketService && typeof websocketService.isConnected === 'function' && websocketService.isConnected()) {
                    if (typeof websocketService.sendMessage === 'function') {
                        websocketService.sendMessage({
                            type: 'user_status',
                            data: {
                                user_id: user.id,
                                status: 'offline',
                                last_seen: new Date().toISOString()
                            }
                        });
                    }
                }
                console.log('[WebSocketContext] 🔌 Déconnexion WebSocket');
                if (websocketService && typeof websocketService.disconnect === 'function') {
                    websocketService.disconnect();
                }
            }
        };
    }, [user?.id]);

    // Gérer les changements de statut de connexion
    useEffect(() => {
        // ✅ SÉCURITÉ: Vérifier que websocketService existe
        if (!websocketService || typeof websocketService.onStatusChange !== 'function') {
            console.warn('[WebSocketContext] websocketService.onStatusChange non disponible');
            // ✅ CORRIGÉ: Retourner une fonction vide au lieu de undefined
            return () => { };
        }

        const handleStatusChange = (status: 'online' | 'offline') => {
            console.log('[WebSocketContext] 📡 Statut connexion:', status);
            setIsConnected(status === 'online');

            if (status === 'online' && user?.id) {
                // Renvoyer le statut utilisateur après reconnexion
                if (websocketService && typeof websocketService.sendMessage === 'function') {
                    websocketService.sendMessage({
                        type: 'user_status',
                        data: {
                            user_id: user.id,
                            status: 'online',
                            last_seen: new Date().toISOString()
                        }
                    });
                }
            }
        };

        const unsubscribe = websocketService.onStatusChange(handleStatusChange);

        // ✅ PATCH CRITIQUE: Utiliser safeCleanup pour garantir une fonction valide
        return safeCleanup(unsubscribe);
    }, [user?.id]);

    // Gérer les messages WebSocket
    useEffect(() => {
        const handleMessage = (message: any) => {
            // ✅ CORRIGÉ: Vérifier que message.type existe avant de le logger
            const messageType = message?.type || message?.message_type || 'unknown';
            console.log('[WebSocketContext] 📨 Message reçu:', messageType);

            // ✅ CORRIGÉ: Gérer le cas où message.type est undefined
            if (!messageType || messageType === 'unknown' || messageType === 'undefined') {
                console.warn('[WebSocketContext] ❓ Type de message non géré:', messageType, 'Message complet:', message);
                return;
            }

            switch (messageType) {
                case 'notification':
                    // Afficher une notification locale
                    // ✅ Normaliser un payload “notification” minimal (certains backends n’envoient pas title/priority)
                    const notification = (() => {
                        const raw = message as any;
                        const data = raw?.data ?? {};
                        const title = data.title ?? 'Notification';
                        const msg = data.message ?? data.msg ?? data.text ?? 'Nouvelle notification disponible';
                        const userId = data.user_id ?? raw?.user_id ?? String(user?.id ?? '');
                        return {
                            type: 'notification',
                            data: {
                                id: data.id ?? `${Date.now()}`,
                                user_id: String(userId),
                                title,
                                message: msg,
                                type: data.type ?? 'info',
                                // on accepte timestamp au root ou dans data
                                timestamp: data.timestamp ?? raw?.timestamp ?? new Date().toISOString(),
                                // compat optionnelle
                                priority: data.priority,
                            }
                        } as unknown as NotificationMessage & { data: any };
                    })();
                    console.log('[WebSocketContext] 🔔 Notification:', notification.data?.title);

                    // ✅ SÉCURITÉ: Notifier tous les handlers enregistrés (vérifier que ce sont des fonctions)
                    notificationHandlers.forEach(handler => {
                        if (typeof handler === 'function') {
                            handler(notification);
                        }
                    });

                    // Afficher une alerte si l'app est au premier plan
                    if (notification.data?.priority === 'high') {
                        Alert.alert(
                            notification.data.title,
                            notification.data.message,
                            [{ text: 'OK' }]
                        );
                    }
                    break;

                case 'chat_message':
                    const chatMessage = message as ChatMessage;
                    console.log('[WebSocketContext] 💬 Message chat:', chatMessage.data?.service_id);

                    // ✅ SÉCURITÉ: Notifier tous les handlers enregistrés (vérifier que ce sont des fonctions)
                    chatMessageHandlers.forEach(handler => {
                        if (typeof handler === 'function') {
                            handler(chatMessage);
                        }
                    });

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

                    // ✅ SÉCURITÉ: Notifier tous les handlers enregistrés (vérifier que ce sont des fonctions)
                    userStatusHandlers.forEach(handler => {
                        if (typeof handler === 'function') {
                            handler(statusUpdate);
                        }
                    });

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
                    console.log('[WebSocketContext] ❓ Type de message non géré:', messageType);
            }
        };

        // ✅ SÉCURITÉ: Vérifier que websocketService.onMessage existe
        if (!websocketService || typeof websocketService.onMessage !== 'function') {
            console.warn('[WebSocketContext] websocketService.onMessage non disponible');
            // ✅ CORRIGÉ: Retourner une fonction vide au lieu de undefined
            return () => { };
        }

        const unsubscribe = websocketService.onMessage(handleMessage);

        // ✅ PATCH CRITIQUE: Utiliser safeCleanup pour garantir une fonction valide
        return safeCleanup(unsubscribe);
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

    // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
    const safeChildren = React.Children.map(children, (child, index) => {
        if (typeof child === 'string' || typeof child === 'number') {
            return <Text key={index}>{String(child)}</Text>;
        }
        if (child == null) {
            return null;
        }
        return child;
    });

    return (
        <WebSocketContext.Provider value={value}>
            {safeChildren}
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


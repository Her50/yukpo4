import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ENDPOINTS, WS_ENDPOINTS } from '../config/api.config';
import { apiDelete, apiPost, apiPut } from '../services/api';

interface ChatMessage {
    id: string;
    from: 'client' | 'prestataire';
    content: string;
    timestamp: Date;
    status: 'sent' | 'delivered' | 'read';
    type: 'text' | 'audio' | 'image' | 'file';
    audioUrl?: string;
    imageUrl?: string;
    fileUrl?: string;
    editable: boolean;
    edited?: boolean;
    editedAt?: Date;
}

interface UseWebSocketChatReturn {
    messages: ChatMessage[];
    isConnected: boolean;
    isTyping: boolean;
    sendMessage: (content: string, type?: 'text' | 'audio' | 'image' | 'file') => Promise<void>;
    editMessage: (messageId: string, newContent: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    markAsRead: () => Promise<void>;
}

export const useWebSocketChat = (serviceId: number, prestataireId: number, userId: number): UseWebSocketChatReturn => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialiser le message de bienvenue
    useEffect(() => {
        const welcomeMessage: ChatMessage = {
            id: Date.now().toString(),
            from: 'prestataire',
            content: `Bonjour 👋, je suis là pour vous aider avec votre demande. Que puis-je faire pour vous ?`,
            timestamp: new Date(),
            status: 'read',
            type: 'text',
            editable: false
        };
        setMessages([welcomeMessage]);
    }, []);

    const connectWebSocket = useCallback(() => {
        try {
            console.log('🔌 [useWebSocketChat] Connexion WebSocket...');

            // ✅ CORRIGÉ: Utilise la configuration centralisée
            const wsUrl = WS_ENDPOINTS.CHAT(serviceId, prestataireId, userId);
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                console.log('✅ [useWebSocketChat] WebSocket connecté');
                setIsConnected(true);

                // Envoyer un message d'authentification
                if (wsRef.current) {
                    wsRef.current.send(JSON.stringify({
                        type: 'auth',
                        userId,
                        serviceId,
                        prestataireId
                    }));
                }

                // Démarrer le heartbeat
                startHeartbeat();
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 [useWebSocketChat] Message reçu:', data);

                    switch (data.type) {
                        case 'message':
                            const newMessage: ChatMessage = {
                                id: data.id || Date.now().toString(),
                                from: data.from === userId ? 'client' : 'prestataire',
                                content: data.content,
                                timestamp: new Date(data.timestamp || Date.now()),
                                status: data.status || 'delivered',
                                type: data.messageType || 'text',
                                audioUrl: data.audioUrl,
                                imageUrl: data.imageUrl,
                                fileUrl: data.fileUrl,
                                editable: data.from === userId
                            };

                            setMessages(prev => [...prev, newMessage]);
                            break;

                        case 'typing':
                            setIsTyping(data.isTyping);
                            break;

                        case 'message_edited':
                            setMessages(prev => prev.map(msg =>
                                msg.id === data.messageId
                                    ? { ...msg, content: data.newContent, edited: true, editedAt: new Date() }
                                    : msg
                            ));
                            break;

                        case 'message_deleted':
                            setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
                            break;

                        case 'message_read':
                            setMessages(prev => prev.map(msg =>
                                msg.from === 'client' ? { ...msg, status: 'read' } : msg
                            ));
                            break;

                        case 'error':
                            console.error('❌ [useWebSocketChat] Erreur serveur:', data.message);
                            break;
                    }
                } catch (error) {
                    console.error('❌ [useWebSocketChat] Erreur parsing message:', error);
                }
            };

            wsRef.current.onclose = (event) => {
                console.log('🔌 [useWebSocketChat] WebSocket fermé:', event.code, event.reason);
                setIsConnected(false);
                setIsTyping(false);

                // Tentative de reconnexion automatique
                if (event.code !== 1000) { // Pas une fermeture normale
                    reconnectTimeoutRef.current = setTimeout(() => {
                        console.log('🔄 [useWebSocketChat] Tentative de reconnexion...');
                        connectWebSocket();
                    }, 3000);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('❌ [useWebSocketChat] Erreur WebSocket:', error);
                setIsConnected(false);
            };

        } catch (error) {
            console.error('❌ [useWebSocketChat] Erreur connexion WebSocket:', error);
            setIsConnected(false);
        }
    }, [serviceId, prestataireId, userId]);

    const startHeartbeat = useCallback(() => {
        heartbeatIntervalRef.current = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000); // Ping toutes les 30 secondes
    }, []);

    const sendMessage = useCallback(async (content: string, type: 'text' | 'audio' | 'image' | 'file' = 'text'): Promise<void> => {
        if (!content.trim()) return;

        const messageId = Date.now().toString();
        const message: ChatMessage = {
            id: messageId,
            from: 'client',
            content,
            timestamp: new Date(),
            status: 'sent',
            type,
            editable: true
        };

        // Ajouter le message localement immédiatement
        setMessages(prev => [...prev, message]);

        // Envoyer via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'message',
                id: messageId,
                content,
                messageType: type,
                from: userId,
                to: prestataireId,
                serviceId,
                timestamp: message.timestamp.toISOString()
            }));
        } else {
            console.warn('⚠️ [useWebSocketChat] WebSocket non connecté, envoi via API REST');

            // ✅ CORRIGÉ: Fallback via API REST avec apiPost
            try {
                const response = await apiPost(API_ENDPOINTS.CHAT.SEND_MESSAGE, {
                    serviceId,
                    prestataireId,
                    content,
                    messageType: type,
                    timestamp: message.timestamp.toISOString()
                });

                if (response.success) {
                    setMessages(prev => prev.map(msg =>
                        msg.id === messageId ? { ...msg, status: 'delivered' } : msg
                    ));
                } else {
                    throw new Error('Erreur envoi message');
                }
            } catch (error) {
                console.error('❌ [useWebSocketChat] Erreur envoi REST:', error);
                setMessages(prev => prev.map(msg =>
                    msg.id === messageId ? { ...msg, status: 'sent' } : msg
                ));
            }
        }
    }, [serviceId, prestataireId, userId]);

    const editMessage = useCallback(async (messageId: string, newContent: string): Promise<void> => {
        if (!newContent.trim()) return;

        // Mettre à jour localement
        setMessages(prev => prev.map(msg =>
            msg.id === messageId
                ? { ...msg, content: newContent, edited: true, editedAt: new Date() }
                : msg
        ));

        // Envoyer la modification via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'edit_message',
                messageId,
                newContent,
                from: userId,
                timestamp: new Date().toISOString()
            }));
        } else {
            // ✅ CORRIGÉ: Fallback REST avec apiPut
            try {
                await apiPut(`/api/chat/messages/${messageId}/edit`, { newContent });
            } catch (error) {
                console.error('❌ [useWebSocketChat] Erreur édition REST:', error);
            }
        }
    }, [userId]);

    const deleteMessage = useCallback(async (messageId: string): Promise<void> => {
        // Supprimer localement
        setMessages(prev => prev.filter(msg => msg.id !== messageId));

        // Envoyer la suppression via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'delete_message',
                messageId,
                from: userId,
                timestamp: new Date().toISOString()
            }));
        } else {
            // ✅ CORRIGÉ: Fallback REST avec apiDelete
            try {
                await apiDelete(`/api/chat/messages/${messageId}`);
            } catch (error) {
                console.error('❌ [useWebSocketChat] Erreur suppression REST:', error);
            }
        }
    }, [userId]);

    const markAsRead = useCallback(async (): Promise<void> => {
        // Marquer les messages comme lus localement
        setMessages(prev => prev.map(msg =>
            msg.from === 'prestataire' ? { ...msg, status: 'read' } : msg
        ));

        // Envoyer la confirmation de lecture via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'mark_read',
                from: userId,
                timestamp: new Date().toISOString()
            }));
        }
    }, [userId]);

    // Connexion initiale
    useEffect(() => {
        if (serviceId && prestataireId && userId) {
            connectWebSocket();
        }

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [serviceId, prestataireId, userId, connectWebSocket]);

    return {
        messages,
        isConnected,
        isTyping,
        sendMessage,
        editMessage,
        deleteMessage,
        markAsRead
    };
};

// Fonction utilitaire pour récupérer le token
const getToken = async (): Promise<string | null> => {
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        let token = await AsyncStorage.getItem('auth_token');
        if (!token) {
            token = await AsyncStorage.getItem('token');
        }
        return token;
    } catch (error) {
        console.error('❌ [useWebSocketChat] Erreur récupération token:', error);
        return null;
    }
};




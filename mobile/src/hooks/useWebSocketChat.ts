// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ENDPOINTS, WS_ENDPOINTS } from '../config/api.config';
import i18n from '../i18n';
import { apiDelete, apiPost, apiPut } from '../services/api';
import SafeStorage from '../utils/safeStorage';

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
    reply_to?: {
        id: string;
        sender_name: string;
        content: string;
        content_type: string;
    };
}

interface MediaData {
    images?: string[];
    audio?: string;
    documents?: string[];
    mentioned_users?: number[];
    reply_to_id?: string;
    reply_to?: {
        id: string;
        sender_name: string;
        content: string;
        content_type: string;
        imageUrl?: string;
        audioUrl?: string;
        fileUrl?: string;
    };
}

interface UseWebSocketChatReturn {
    messages: ChatMessage[];
    isConnected: boolean;
    isTyping: boolean;
    sendMessage: (content: string, type?: 'text' | 'audio' | 'image' | 'file', mediaData?: MediaData) => Promise<void>;
    editMessage: (messageId: string, newContent: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    markAsRead: () => Promise<void>;
    setInitialMessages?: (messages: ChatMessage[]) => void;  // ✅ NOUVEAU: Pour définir les messages initiaux
}

export const useWebSocketChat = (serviceId: number, prestataireId: number, userId: number): UseWebSocketChatReturn => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialiser le message de bienvenue ou les messages initiaux
    const initializeMessages = useCallback((initialMsgs?: ChatMessage[]) => {
        if (initialMsgs && initialMsgs.length > 0) {
            // ✅ NOUVEAU: Utiliser les messages initiaux fournis
            setMessages(initialMsgs);
        } else {
            // ✅ COMPORTEMENT PAR DÉFAUT: Message de bienvenue
            const welcomeMessage: ChatMessage = {
                id: Date.now().toString(),
                from: 'prestataire',
                content: (i18n.t('chatModalMobile.wsWelcome') as string) || `Bonjour \uD83D\uDC4B, je suis là pour vous aider avec votre demande. Que puis-je faire pour vous ?`,
                timestamp: new Date(),
                status: 'read',
                type: 'text',
                editable: false
            };
            setMessages([welcomeMessage]);
        }
    }, []);

    // ✅ NOUVEAU: Fonction pour définir les messages initiaux
    const setInitialMessages = useCallback((initialMsgs: ChatMessage[]) => {
        if (initialMsgs && initialMsgs.length > 0) {
            // ✅ NOUVEAU: Utiliser les messages initiaux fournis
            setMessages(initialMsgs);
        }
    }, []);

    // Initialisation par défaut (sera remplacée si setInitialMessages est appelé)
    useEffect(() => {
        initializeMessages();
    }, [initializeMessages]);

    const connectWebSocket = useCallback(() => {
        // ✅ CORRIGÉ: Vérifier que les IDs sont valides avant de se connecter
        // ✅ CORRIGÉ 2025-12-20: Conversion explicite en number pour gérer les cas où userId peut être string
        const serviceIdNum = Number(serviceId);
        const prestataireIdNum = Number(prestataireId);
        const userIdNum = Number(userId);

        if (!serviceIdNum || typeof serviceIdNum !== 'number' || isNaN(serviceIdNum) || serviceIdNum <= 0) {
            console.error('❌ [useWebSocketChat] serviceId invalide:', serviceId, '(type:', typeof serviceId, ')');
            return;
        }
        if (!prestataireIdNum || typeof prestataireIdNum !== 'number' || isNaN(prestataireIdNum) || prestataireIdNum <= 0) {
            console.error('❌ [useWebSocketChat] prestataireId invalide:', prestataireId, '(type:', typeof prestataireId, ')');
            return;
        }
        if (!userIdNum || typeof userIdNum !== 'number' || isNaN(userIdNum) || userIdNum <= 0) {
            console.error('❌ [useWebSocketChat] userId invalide:', userId, '(type:', typeof userId, ')');
            return;
        }

        try {
            console.log('\uD83D\uDD0C [useWebSocketChat] Connexion WebSocket...');

            // ✅ CORRIGÉ: Utilise la configuration centralisée avec valeurs converties en number
            const wsUrl = WS_ENDPOINTS.CHAT(serviceIdNum, prestataireIdNum, userIdNum);
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                console.log('✅ [useWebSocketChat] WebSocket connecté');
                setIsConnected(true);

                // Envoyer un message d'authentification
                // ✅ CORRIGÉ 2025-12-18: Vérifier l'état avant envoi auth
                if (wsRef.current) {
                    try {
                        if (wsRef.current.readyState === WebSocket.OPEN) {
                            wsRef.current.send(JSON.stringify({
                                type: 'auth',
                                userId: userIdNum,
                                serviceId: serviceIdNum,
                                prestataireId: prestataireIdNum
                            }));
                        } else {
                            console.warn(`⚠️ [useWebSocketChat] WebSocket non ouvert pour auth (état: ${wsRef.current.readyState})`);
                        }
                    } catch (error: any) {
                        console.error('❌ [useWebSocketChat] Erreur envoi auth:', error);
                    }
                }

                // Démarrer le heartbeat
                startHeartbeat();
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const rawData = JSON.parse(event.data);
                    console.log('\uD83D\uDCE8 [useWebSocketChat] Message reçu:', rawData);

                    // ✅ CORRIGÉ: Le serveur envoie ChatWsMessage avec { message_type, data, user_id, ... }
                    // On doit extraire le payload depuis rawData.data si c'est le nouveau format
                    const isNewFormat = rawData.message_type !== undefined && rawData.data !== undefined;
                    const data = isNewFormat ? rawData.data : rawData;
                    const msgType = isNewFormat ? rawData.message_type : data.type;
                    const senderUserId = isNewFormat ? rawData.user_id : data.from;

                    // ✅ CORRIGÉ: Ignorer les messages envoyés par nous-mêmes (déjà ajoutés localement)
                    if (msgType === 'message' && senderUserId === userIdNum) {
                        console.log('\uD83D\uDCE8 [useWebSocketChat] Message de nous-même ignoré (déjà ajouté localement)');
                        return;
                    }

                    switch (msgType) {
                        case 'message':
                            const newMessage: ChatMessage = {
                                id: data.id || Date.now().toString(),
                                from: senderUserId === userIdNum ? 'client' : 'prestataire',
                                content: data.content,
                                timestamp: new Date(data.timestamp || Date.now()),
                                status: data.status || 'delivered',
                                type: data.messageType || 'text',
                                audioUrl: data.audioUrl,
                                imageUrl: data.imageUrl,
                                fileUrl: data.fileUrl,
                                editable: senderUserId === userIdNum
                            };

                            setMessages(prev => [...prev, newMessage]);
                            break;

                        case 'typing':
                            // ✅ CORRIGÉ: N'afficher typing que si c'est l'autre utilisateur
                            if (senderUserId !== userIdNum) {
                                setIsTyping(data.isTyping);
                            }
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

                        case 'reaction_added':
                            console.log('✅ [useWebSocketChat] Réaction ajoutée:', data);
                            break;

                        case 'reaction_removed':
                            console.log('✅ [useWebSocketChat] Réaction supprimée:', data);
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
                console.log('\uD83D\uDD0C [useWebSocketChat] WebSocket fermé:', event.code, event.reason);
                setIsConnected(false);
                setIsTyping(false);

                // Tentative de reconnexion automatique
                if (event.code !== 1000) { // Pas une fermeture normale
                    reconnectTimeoutRef.current = setTimeout(() => {
                        console.log('\uD83D\uDD04 [useWebSocketChat] Tentative de reconnexion...');
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
            if (wsRef.current) {
                try {
                    // ✅ CORRIGÉ 2025-12-18: Vérifier l'état avant ping pour éviter INVALID_STATE_ERR
                    if (wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: 'ping' }));
                    } else {
                        console.warn(`⚠️ [useWebSocketChat] WebSocket non ouvert pour ping (état: ${wsRef.current.readyState})`);
                    }
                } catch (error: any) {
                    console.error('❌ [useWebSocketChat] Erreur ping WebSocket:', error);
                    // Si erreur INVALID_STATE, forcer reconnexion
                    if (error?.message?.includes('INVALID_STATE') || error?.name === 'InvalidStateError') {
                        if (wsRef.current) {
                            try {
                                wsRef.current.close();
                            } catch (e) {
                                // Ignorer
                            }
                            wsRef.current = null;
                            connectWebSocket();
                        }
                    }
                }
            }
        }, 30000); // Ping toutes les 30 secondes
    }, []);

    const sendMessage = useCallback(async (content: string, type: 'text' | 'audio' | 'image' | 'file' = 'text', mediaData?: MediaData): Promise<void> => {
        // ✅ CORRIGÉ: Accepter les messages vides si des médias sont fournis
        if (!content.trim() && !mediaData) return;

        const messageId = Date.now().toString();

        // ✅ NOUVEAU: Gérer l'envoi de plusieurs médias
        const messagesToSend: ChatMessage[] = [];

        // Envoyer les images si présentes
        if (mediaData?.images && mediaData.images.length > 0) {
            for (const image of mediaData.images) {
                const imageMessage: ChatMessage = {
                    id: `${messageId}_img_${Date.now()}`,
                    from: 'client',
                    content: '\uD83D\uDCF7 Image',
                    timestamp: new Date(),
                    status: 'sent',
                    type: 'image',
                    imageUrl: image,
                    editable: false
                };
                messagesToSend.push(imageMessage);
            }
        }

        // Envoyer l'audio si présent
        if (mediaData?.audio) {
            const audioMessage: ChatMessage = {
                id: `${messageId}_audio_${Date.now()}`,
                from: 'client',
                content: '\uD83C\uDFA4 Message vocal',
                timestamp: new Date(),
                status: 'sent',
                type: 'audio',
                audioUrl: mediaData.audio,
                editable: false
            };
            messagesToSend.push(audioMessage);
        }

        // Envoyer les documents si présents
        if (mediaData?.documents && mediaData.documents.length > 0) {
            for (const doc of mediaData.documents) {
                const docMessage: ChatMessage = {
                    id: `${messageId}_doc_${Date.now()}`,
                    from: 'client',
                    content: '\uD83D\uDCCE Document',
                    timestamp: new Date(),
                    status: 'sent',
                    type: 'file',
                    fileUrl: doc,
                    editable: false
                };
                messagesToSend.push(docMessage);
            }
        }

        // Envoyer le message texte si présent
        if (content.trim()) {
            const textMessage: ChatMessage = {
                id: messageId,
                from: 'client',
                content,
                timestamp: new Date(),
                status: 'sent',
                type,
                editable: true,
                // ✅ NOUVEAU: Inclure la réponse si présente
                reply_to: mediaData?.reply_to_id ? {
                    id: mediaData.reply_to_id,
                    sender_name: '', // Sera rempli par le backend
                    content: '',
                    content_type: 'text'
                } : undefined
            };
            messagesToSend.push(textMessage);
        }

        // Ajouter tous les messages localement immédiatement
        setMessages(prev => [...prev, ...messagesToSend]);

        // Envoyer chaque message via WebSocket ou REST
        for (const msg of messagesToSend) {
            // ✅ CORRIGÉ 2025-12-18: Vérifier l'état WebSocket de manière robuste avec try-catch
            let wsSendSuccess = false;
            if (wsRef.current) {
                try {
                    // Vérifier l'état juste avant l'envoi pour éviter INVALID_STATE_ERR
                    if (wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({
                            type: 'message',
                            id: msg.id,
                            content: msg.content,
                            messageType: msg.type,
                            from: userId,
                            to: prestataireId,
                            serviceId,
                            timestamp: msg.timestamp.toISOString(),
                            // ✅ NOUVEAU: Inclure les URLs des médias
                            audioUrl: msg.audioUrl,
                            imageUrl: msg.imageUrl,
                            fileUrl: msg.fileUrl,
                            // ✅ NOUVEAU: Inclure les mentions et réponses
                            mentioned_users: mediaData?.mentioned_users,
                            reply_to_id: mediaData?.reply_to_id
                        }));
                        wsSendSuccess = true;
                    } else {
                        console.warn(`⚠️ [useWebSocketChat] WebSocket état invalide: ${wsRef.current.readyState} (OPEN=${WebSocket.OPEN})`);
                    }
                } catch (error: any) {
                    console.error('❌ [useWebSocketChat] Erreur envoi WebSocket:', error);
                    // Si erreur INVALID_STATE_ERR, forcer reconnexion
                    if (error?.message?.includes('INVALID_STATE') || error?.name === 'InvalidStateError') {
                        console.warn('\uD83D\uDD04 [useWebSocketChat] INVALID_STATE_ERR détecté, reconnexion...');
                        if (wsRef.current) {
                            try {
                                wsRef.current.close();
                            } catch (e) {
                                // Ignorer erreur de fermeture
                            }
                            wsRef.current = null;
                            connectWebSocket();
                        }
                    }
                }
            }

            if (!wsSendSuccess) {
                console.warn('⚠️ [useWebSocketChat] WebSocket non connecté, envoi via API REST');

                // ✅ CORRIGÉ: Fallback via API REST avec apiPost
                try {
                    const response = await apiPost(API_ENDPOINTS.CHAT.SEND_MESSAGE, {
                        recipient_id: prestataireId,
                        service_id: serviceId,
                        content: msg.content,
                        type: msg.type,
                        metadata: {
                            timestamp: msg.timestamp.toISOString(),
                            audioUrl: msg.audioUrl,
                            imageUrl: msg.imageUrl,
                            fileUrl: msg.fileUrl,
                            mentioned_users: mediaData?.mentioned_users,
                            reply_to_id: mediaData?.reply_to_id
                        }
                    });

                    if (response.success) {
                        setMessages(prev => prev.map(m =>
                            m.id === msg.id ? { ...m, status: 'delivered' } : m
                        ));

                        // ✅ NOUVEAU: Notifier le destinataire
                        try {
                            const user = await getUserInfo();
                            await apiPost(API_ENDPOINTS.CHAT.NOTIFY_MESSAGE, {
                                recipient_id: prestataireId,
                                sender_id: userId,
                                sender_name: user?.name || 'Un utilisateur',
                                message_preview: msg.content || (msg.type === 'image' ? '\uD83D\uDCF7 Image' : msg.type === 'audio' ? '\uD83C\uDFA4 Audio' : '\uD83D\uDCCE Fichier'),
                                service_id: serviceId,
                                service_title: 'Service'
                            });
                            console.log('✅ [useWebSocketChat] Notification envoyée au destinataire');
                        } catch (notifError) {
                            console.warn('⚠️ [useWebSocketChat] Erreur notification (message envoyé quand même):', notifError);
                        }
                    } else {
                        throw new Error('Erreur envoi message');
                    }
                } catch (error) {
                    console.error('❌ [useWebSocketChat] Erreur envoi REST:', error);
                    setMessages(prev => prev.map(m =>
                        m.id === msg.id ? { ...m, status: 'sent' } : m
                    ));
                }
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
        // ✅ CORRIGÉ 2025-12-18: Protection try-catch pour éviter INVALID_STATE_ERR
        let wsEditSuccess = false;
        if (wsRef.current) {
            try {
                if (wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'edit_message',
                        messageId,
                        newContent,
                        from: userId,
                        timestamp: new Date().toISOString()
                    }));
                    wsEditSuccess = true;
                }
            } catch (error: any) {
                console.error('❌ [useWebSocketChat] Erreur envoi édition WebSocket:', error);
            }
        }

        if (!wsEditSuccess) {
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
        // ✅ CORRIGÉ 2025-12-18: Protection try-catch pour éviter INVALID_STATE_ERR
        let wsDeleteSuccess = false;
        if (wsRef.current) {
            try {
                if (wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'delete_message',
                        messageId,
                        from: userId,
                        timestamp: new Date().toISOString()
                    }));
                    wsDeleteSuccess = true;
                }
            } catch (error: any) {
                console.error('❌ [useWebSocketChat] Erreur envoi suppression WebSocket:', error);
            }
        }

        if (!wsDeleteSuccess) {
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
        // ✅ CORRIGÉ 2025-12-18: Protection try-catch pour éviter INVALID_STATE_ERR
        if (wsRef.current) {
            try {
                if (wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'mark_read',
                        from: userId,
                        timestamp: new Date().toISOString()
                    }));
                }
            } catch (error: any) {
                console.error('❌ [useWebSocketChat] Erreur envoi mark_read WebSocket:', error);
            }
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
                reconnectTimeoutRef.current = null;
            }
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serviceId, prestataireId, userId]); // ✅ CORRIGÉ: Retirer connectWebSocket des dépendances (stable via useCallback)

    return {
        messages,
        isConnected,
        isTyping,
        sendMessage,
        editMessage,
        deleteMessage,
        markAsRead,
        setInitialMessages  // ✅ NOUVEAU: Retourner la fonction pour définir les messages initiaux
    };
};

// Fonction utilitaire pour récupérer le token
const getToken = async (): Promise<string | null> => {
    try {
        let token = await SafeStorage.getItem('auth_token');
        if (!token) {
            token = await SafeStorage.getItem('token');
        }
        return token;
    } catch (error) {
        console.error('❌ [useWebSocketChat] Erreur récupération token:', error);
        return null;
    }
};

// ✅ NOUVEAU: Fonction utilitaire pour récupérer les infos utilisateur
const getUserInfo = async (): Promise<{ name: string; email: string } | null> => {
    try {
        const userDataStr = await SafeStorage.getItem('user');
        if (userDataStr) {
            const userData = JSON.parse(userDataStr);
            return {
                name: userData.name || userData.nom_complet || 'Utilisateur',
                email: userData.email || ''
            };
        }
        return null;
    } catch (error) {
        console.error('❌ [useWebSocketChat] Erreur récupération user:', error);
        return null;
    }
};




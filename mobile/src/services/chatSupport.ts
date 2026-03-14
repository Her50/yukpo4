/**
 * Service de chat support en temps réel
 */

import { analytics } from './analytics';
import { apiGet, apiPost } from './api';

interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'support';
    timestamp: number;
    read: boolean;
    attachments?: Array<{ type: string; url: string }>;
}

interface ChatSession {
    id: string;
    status: 'active' | 'resolved' | 'closed';
    created_at: number;
    last_message_at: number;
    agent_name?: string;
    agent_avatar?: string;
}

class ChatSupportService {
    private currentSession: ChatSession | null = null;
    private messages: ChatMessage[] = [];

    /**
     * Démarrer une nouvelle session de chat
     */
    async startChatSession(userId: number, topic?: string): Promise<ChatSession | null> {
        try {
            const response = await apiPost('/api/support/chat/start', {
                user_id: userId,
                topic,
            });

            if (response.success && response.session) {
                this.currentSession = response.session;
                analytics.track('chat_session_started', {
                    session_id: response.session.id,
                    topic,
                });
                return response.session;
            }
            return null;
        } catch (error) {
            console.error('[ChatSupport] Erreur démarrage session:', error);
            return null;
        }
    }

    /**
     * Envoyer un message
     */
    async sendMessage(sessionId: string, text: string, attachments?: Array<{ type: string; url: string }>): Promise<ChatMessage | null> {
        try {
            const response = await apiPost('/api/support/chat/message', {
                session_id: sessionId,
                text,
                attachments,
            });

            if (response.success && (response as any).message) {
                this.messages.push((response as any).message);
                analytics.track('chat_message_sent', {
                    session_id: sessionId,
                    has_attachments: !!attachments?.length,
                });
                return (response as any).message;
            }
            return null;
        } catch (error) {
            console.error('[ChatSupport] Erreur envoi message:', error);
            return null;
        }
    }

    /**
     * Récupérer les messages d'une session
     */
    async getMessages(sessionId: string, limit: number = 50): Promise<ChatMessage[]> {
        try {
            const response = await apiGet(`/api/support/chat/messages?session_id=${sessionId}&limit=${limit}`);

            if (response.success && response.messages) {
                this.messages = response.messages;
                return response.messages;
            }
            return [];
        } catch (error) {
            console.error('[ChatSupport] Erreur récupération messages:', error);
            return [];
        }
    }

    /**
     * Obtenir les sessions actives de l'utilisateur
     */
    async getActiveSessions(userId: number): Promise<ChatSession[]> {
        try {
            const response = await apiGet(`/api/support/chat/sessions?user_id=${userId}`);

            if (response.success && response.sessions) {
                return response.sessions;
            }
            return [];
        } catch (error) {
            console.error('[ChatSupport] Erreur sessions:', error);
            return [];
        }
    }

    /**
     * Fermer une session
     */
    async closeSession(sessionId: string, rating?: number, feedback?: string): Promise<boolean> {
        try {
            const response = await apiPost('/api/support/chat/close', {
                session_id: sessionId,
                rating,
                feedback,
            });

            if (response.success) {
                analytics.track('chat_session_closed', {
                    session_id: sessionId,
                    rating,
                    has_feedback: !!feedback,
                });
                if (this.currentSession?.id === sessionId) {
                    this.currentSession = null;
                    this.messages = [];
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('[ChatSupport] Erreur fermeture session:', error);
            return false;
        }
    }

    /**
     * Obtenir la session actuelle
     */
    getCurrentSession(): ChatSession | null {
        return this.currentSession;
    }

    /**
     * Obtenir les messages en cache
     */
    getCachedMessages(): ChatMessage[] {
        return this.messages;
    }
}

export const chatSupport = new ChatSupportService();
export default chatSupport;



// ✅ NOUVEAU Phase 2.4: Service frontend pour collaboration en temps réel

import {
    CollaborationAction,
    CollaborationCursor,
    CollaborationMessage
} from '../types/Collaboration';

const WS_BASE_URL = process.env.API_BASE_URL?.replace(/^http/, 'ws') || 'ws://localhost:3000';

export class CollaborationService {
    private ws: WebSocket | null = null;
    private sessionId: string | null = null;
    private userId: string | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();

    /**
     * Se connecte à une session de collaboration
     */
    async connect(
        sessionId: string,
        userId: string,
        onMessage?: (message: CollaborationMessage) => void
    ): Promise<void> {
        this.sessionId = sessionId;
        this.userId = userId;

        const wsUrl = `${WS_BASE_URL}/ws/collaboration/${sessionId}?userId=${userId}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('[CollaborationService] WebSocket connecté');
            this.reconnectAttempts = 0;
            this.send({
                type: 'join',
                userId,
                sessionId,
                timestamp: Date.now(),
            });
        };

        this.ws.onmessage = (event) => {
            try {
                const message: CollaborationMessage = JSON.parse(event.data);
                if (onMessage) {
                    onMessage(message);
                }
                this.handleMessage(message);
            } catch (error) {
                console.error('[CollaborationService] Erreur parsing message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('[CollaborationService] Erreur WebSocket:', error);
        };

        this.ws.onclose = () => {
            console.log('[CollaborationService] WebSocket fermé');
            this.attemptReconnect();
        };
    }

    /**
     * Se déconnecte de la session
     */
    disconnect(): void {
        if (this.ws && this.sessionId && this.userId) {
            this.send({
                type: 'leave',
                userId: this.userId,
                sessionId: this.sessionId,
                timestamp: Date.now(),
            });
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Envoie un message
     */
    private send(message: Partial<CollaborationMessage>): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    /**
     * Publie une action de collaboration
     */
    publishAction(action: CollaborationAction): void {
        this.send({
            type: 'action',
            userId: this.userId!,
            sessionId: this.sessionId!,
            data: action,
            timestamp: Date.now(),
        });
    }

    /**
     * Publie le mouvement du curseur
     */
    publishCursorMove(cursor: CollaborationCursor): void {
        this.send({
            type: 'cursor_move',
            userId: this.userId!,
            sessionId: this.sessionId!,
            data: cursor,
            timestamp: Date.now(),
        });
    }

    /**
     * Enregistre un handler pour un type de message
     */
    on(messageType: string, handler: (data: any) => void): void {
        if (!this.messageHandlers.has(messageType)) {
            this.messageHandlers.set(messageType, []);
        }
        this.messageHandlers.get(messageType)!.push(handler);
    }

    /**
     * Supprime un handler
     */
    off(messageType: string, handler: (data: any) => void): void {
        const handlers = this.messageHandlers.get(messageType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Gère un message reçu
     */
    private handleMessage(message: CollaborationMessage): void {
        const handlers = this.messageHandlers.get(message.type);
        if (handlers) {
            handlers.forEach((handler) => handler(message.data));
        }
    }

    /**
     * Tentative de reconnexion
     */
    private attemptReconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts && this.sessionId && this.userId) {
            this.reconnectAttempts++;
            console.log(
                `[CollaborationService] Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
            );

            setTimeout(() => {
                this.connect(this.sessionId!, this.userId!).catch((error) => {
                    console.error('[CollaborationService] Erreur reconnexion:', error);
                });
            }, this.reconnectDelay * this.reconnectAttempts);
        }
    }

    /**
     * Ping pour maintenir la connexion
     */
    ping(): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.send({
                type: 'ping',
                userId: this.userId!,
                sessionId: this.sessionId!,
                timestamp: Date.now(),
            });
        }
    }

    /**
     * Vérifie si connecté
     */
    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}

// Instance singleton
export const collaborationService = new CollaborationService();


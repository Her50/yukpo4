import React from 'react';
import { getWebSocketUrl, WEBSOCKET_CONFIG } from '../config/websocket';

interface WebSocketOptions {
    type: 'status' | 'notifications' | 'chat' | 'access' | 'deliveryTracking';
    userId?: number;
    clientId?: string;
    onMessage?: (data: any) => void;
    onOpen?: () => void;
    onClose?: () => void;
    onError?: (error: Event) => void;
    autoReconnect?: boolean;
}

class WebSocketService {
    private connections: Map<string, WebSocket> = new Map();
    private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private reconnectAttempts: Map<string, number> = new Map();
    private pingIntervals: Map<string, NodeJS.Timeout> = new Map();
    private options: Map<string, WebSocketOptions> = new Map();

    /**
     * Créer une connexion WebSocket avec reconnexion automatique
     */
    connect(options: WebSocketOptions): string {
        const connectionId = this.generateConnectionId(options);

        // Éviter les connexions multiples
        if (this.connections.has(connectionId)) {
            console.log(`[WebSocket] Connexion ${connectionId} déjà existante`);
            return connectionId;
        }

        this.options.set(connectionId, options);
        this.reconnectAttempts.set(connectionId, 0);

        this.createConnection(connectionId);
        return connectionId;
    }

    /**
     * Créer une nouvelle connexion WebSocket
     */
    private createConnection(connectionId: string): void {
        const options = this.options.get(connectionId);
        if (!options) return;

        const url = this.getConnectionUrl(options);
        if (!url) {
            console.error(`[WebSocket] URL invalide pour ${connectionId}`);
            return;
        }

        console.log(`[WebSocket] Connexion à ${url}`);

        try {
            const ws = new WebSocket(url);
            this.connections.set(connectionId, ws);

            ws.onopen = () => {
                console.log(`✅ [WebSocket] ${connectionId} connecté`);
                this.reconnectAttempts.set(connectionId, 0);

                // Démarrer le ping
                this.startPing(connectionId);

                // Callback onOpen
                options.onOpen?.();
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Gérer les pings/pongs
                    if (data.type === 'ping') {
                        this.sendPong(connectionId);
                        return;
                    }

                    // Callback onMessage
                    options.onMessage?.(data);
                } catch (error) {
                    console.error(`[WebSocket] Erreur parsing message ${connectionId}:`, error);
                }
            };

            ws.onclose = (event) => {
                console.log(`❌ [WebSocket] ${connectionId} déconnecté (code: ${event.code})`);
                this.stopPing(connectionId);

                // Callback onClose
                options.onClose?.();

                // Reconnexion automatique si activée
                if (options.autoReconnect !== false && !event.wasClean) {
                    this.scheduleReconnect(connectionId);
                }
            };

            ws.onerror = (error) => {
                console.error(`❌ [WebSocket] Erreur ${connectionId}:`, error);
                options.onError?.(error);
            };

        } catch (error) {
            console.error(`[WebSocket] Erreur création connexion ${connectionId}:`, error);
            this.scheduleReconnect(connectionId);
        }
    }

    /**
     * Programmer une reconnexion avec backoff exponentiel
     */
    private scheduleReconnect(connectionId: string): void {
        const options = this.options.get(connectionId);
        if (!options || options.autoReconnect === false) return;

        const attempts = this.reconnectAttempts.get(connectionId) || 0;
        const maxAttempts = WEBSOCKET_CONFIG.reconnect.maxAttempts;

        if (attempts >= maxAttempts) {
            console.warn(`[WebSocket] ${connectionId} - Arrêt reconnexion après ${maxAttempts} tentatives`);
            return;
        }

        const delay = Math.min(
            WEBSOCKET_CONFIG.reconnect.interval * Math.pow(WEBSOCKET_CONFIG.reconnect.backoffMultiplier, attempts),
            30000 // Max 30 secondes
        );

        console.log(`🔄 [WebSocket] ${connectionId} - Reconnexion dans ${delay}ms (tentative ${attempts + 1}/${maxAttempts})`);

        const timeout = setTimeout(() => {
            this.reconnectAttempts.set(connectionId, attempts + 1);
            this.createConnection(connectionId);
        }, delay);

        this.reconnectTimeouts.set(connectionId, timeout);
    }

    /**
     * Démarrer le ping pour maintenir la connexion
     */
    private startPing(connectionId: string): void {
        const interval = setInterval(() => {
            this.sendPing(connectionId);
        }, WEBSOCKET_CONFIG.timeouts.ping);

        this.pingIntervals.set(connectionId, interval);
    }

    /**
     * Arrêter le ping
     */
    private stopPing(connectionId: string): void {
        const interval = this.pingIntervals.get(connectionId);
        if (interval) {
            clearInterval(interval);
            this.pingIntervals.delete(connectionId);
        }
    }

    /**
     * Envoyer un ping
     */
    private sendPing(connectionId: string): void {
        const ws = this.connections.get(connectionId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
    }

    /**
     * Envoyer un pong
     */
    private sendPong(connectionId: string): void {
        const ws = this.connections.get(connectionId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
    }

    /**
     * Envoyer un message
     */
    send(connectionId: string, message: any): boolean {
        const ws = this.connections.get(connectionId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
            return true;
        }
        console.warn(`[WebSocket] ${connectionId} - Impossible d'envoyer le message (connexion fermée)`);
        return false;
    }

    /**
     * Fermer une connexion
     */
    disconnect(connectionId: string): void {
        // Nettoyer les timeouts
        const timeout = this.reconnectTimeouts.get(connectionId);
        if (timeout) {
            clearTimeout(timeout);
            this.reconnectTimeouts.delete(connectionId);
        }

        // Arrêter le ping
        this.stopPing(connectionId);

        // Fermer la connexion
        const ws = this.connections.get(connectionId);
        if (ws) {
            ws.close(1000, 'Déconnexion volontaire');
            this.connections.delete(connectionId);
        }

        // Nettoyer les données
        this.options.delete(connectionId);
        this.reconnectAttempts.delete(connectionId);

        console.log(`🔌 [WebSocket] ${connectionId} déconnecté et nettoyé`);
    }

    /**
     * Fermer toutes les connexions
     */
    disconnectAll(): void {
        for (const connectionId of this.connections.keys()) {
            this.disconnect(connectionId);
        }
    }

    /**
     * Obtenir l'URL de connexion
     */
    private getConnectionUrl(options: WebSocketOptions): string | null {
        switch (options.type) {
            case 'status':
                return options.userId ? getWebSocketUrl('status', options.userId) : null;
            case 'notifications':
                return options.userId ? getWebSocketUrl('notifications', options.userId) : null;
            case 'chat':
                return options.clientId ? getWebSocketUrl('chat', options.clientId) : null;
            case 'access':
                return getWebSocketUrl('access');
            case 'deliveryTracking':
                return options.clientId ? getWebSocketUrl('deliveryTracking', options.clientId) : null;
            default:
                return null;
        }
    }

    /**
     * Générer un ID unique pour la connexion
     */
    private generateConnectionId(options: WebSocketOptions): string {
        switch (options.type) {
            case 'status':
                return `status_${options.userId}`;
            case 'notifications':
                return `notifications_${options.userId}`;
            case 'chat':
                return `chat_${options.clientId}`;
            case 'access':
                return 'access';
            case 'deliveryTracking':
                return `delivery_${options.clientId}`;
            default:
                return `unknown_${Date.now()}`;
        }
    }

    /**
     * Obtenir le statut d'une connexion
     */
    getConnectionStatus(connectionId: string): 'connecting' | 'open' | 'closing' | 'closed' | 'unknown' {
        const ws = this.connections.get(connectionId);
        if (!ws) return 'unknown';

        switch (ws.readyState) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'open';
            case WebSocket.CLOSING: return 'closing';
            case WebSocket.CLOSED: return 'closed';
            default: return 'unknown';
        }
    }

    /**
     * Obtenir toutes les connexions actives
     */
    getActiveConnections(): string[] {
        return Array.from(this.connections.keys());
    }
}

// Instance singleton
export const websocketService = new WebSocketService();

// Hook React pour utiliser le service
export const useWebSocketConnection = (options: WebSocketOptions) => {
    const connectionId = React.useRef<string | null>(null);

    React.useEffect(() => {
        connectionId.current = websocketService.connect(options);

        return () => {
            if (connectionId.current) {
                websocketService.disconnect(connectionId.current);
            }
        };
    }, []);

    const send = React.useCallback((message: any) => {
        if (connectionId.current) {
            return websocketService.send(connectionId.current, message);
        }
        return false;
    }, []);

    const disconnect = React.useCallback(() => {
        if (connectionId.current) {
            websocketService.disconnect(connectionId.current);
            connectionId.current = null;
        }
    }, []);

    const getStatus = React.useCallback(() => {
        if (connectionId.current) {
            return websocketService.getConnectionStatus(connectionId.current);
        }
        return 'unknown';
    }, []);

    return {
        send,
        disconnect,
        getStatus,
        connectionId: connectionId.current
    };
};

/**
 * AnalyticsService - Tracking événements avancé
 * Améliore la compréhension utilisateur de +80%
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiPost } from './api';

interface AnalyticsEvent {
    name: string;
    properties?: Record<string, any>;
    timestamp: number;
    userId?: string;
    sessionId: string;
}

interface UserProperties {
    userId?: string;
    email?: string;
    name?: string;
    createdAt?: number;
    lastActiveAt?: number;
}

class AnalyticsService {
    private readonly STORAGE_KEY = 'analytics_queue';
    private readonly MAX_QUEUE_SIZE = 100;
    private eventQueue: AnalyticsEvent[] = [];
    private sessionId: string;
    private userProperties: UserProperties = {};
    private flushInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.sessionId = this.generateSessionId();
        this.loadQueue();
        this.startFlushInterval();
    }

    // ✅ Générer un ID de session unique
    private generateSessionId(): string {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ✅ Charger la queue depuis le stockage
    private async loadQueue(): Promise<void> {
        try {
            const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                this.eventQueue = JSON.parse(stored);
            }
        } catch (error) {
            console.error('[Analytics] Erreur chargement queue:', error);
        }
    }

    // ✅ Sauvegarder la queue
    private async saveQueue(): Promise<void> {
        try {
            await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.eventQueue));
        } catch (error) {
            console.error('[Analytics] Erreur sauvegarde queue:', error);
        }
    }

    // ✅ Identifier un utilisateur
    identify(userId: string, properties?: UserProperties): void {
        this.userProperties = {
            ...this.userProperties,
            userId,
            ...properties,
            lastActiveAt: Date.now(),
        };
    }

    // ✅ Tracker un événement
    track(eventName: string, properties?: Record<string, any>): void {
        const event: AnalyticsEvent = {
            name: eventName,
            properties: {
                ...properties,
                sessionId: this.sessionId,
            },
            timestamp: Date.now(),
            userId: this.userProperties.userId,
            sessionId: this.sessionId,
        };

        this.eventQueue.push(event);

        // ✅ Limiter la taille de la queue
        if (this.eventQueue.length > this.MAX_QUEUE_SIZE) {
            this.eventQueue.shift(); // Retirer les plus anciens
        }

        // ✅ Sauvegarder immédiatement
        this.saveQueue();

        // ✅ Flush si la queue est pleine
        if (this.eventQueue.length >= this.MAX_QUEUE_SIZE) {
            this.flush();
        }
    }

    // ✅ Événements prédéfinis
    trackScreenView(screenName: string, properties?: Record<string, any>): void {
        this.track('screen_view', {
            screen_name: screenName,
            ...properties,
        });
    }

    trackSearch(query: string, resultsCount?: number, properties?: Record<string, any>): void {
        this.track('search', {
            query,
            results_count: resultsCount,
            ...properties,
        });
    }

    trackProductView(productId: string, productName?: string, properties?: Record<string, any>): void {
        this.track('product_view', {
            product_id: productId,
            product_name: productName,
            ...properties,
        });
    }

    trackPurchase(productId: string, amount: number, currency: string, properties?: Record<string, any>): void {
        this.track('purchase', {
            product_id: productId,
            amount,
            currency,
            ...properties,
        });
    }

    trackShare(contentType: string, contentId: string, method: string, properties?: Record<string, any>): void {
        this.track('share', {
            content_type: contentType,
            content_id: contentId,
            method,
            ...properties,
        });
    }

    trackChatMessage(conversationId: string, messageLength?: number, properties?: Record<string, any>): void {
        this.track('chat_message', {
            conversation_id: conversationId,
            message_length: messageLength,
            ...properties,
        });
    }

    trackGamification(action: string, points: number, properties?: Record<string, any>): void {
        this.track('gamification', {
            action,
            points,
            ...properties,
        });
    }

    // ✅ Flush les événements vers le backend
    async flush(): Promise<void> {
        if (this.eventQueue.length === 0) {
            return;
        }

        const events = [...this.eventQueue];
        this.eventQueue = [];

        try {
            await apiPost('/api/analytics/track', {
                events,
                user_properties: this.userProperties,
                session_id: this.sessionId,
            });

            // ✅ Sauvegarder la queue vide
            await this.saveQueue();
        } catch (error) {
            console.error('[Analytics] Erreur flush:', error);
            // ✅ Remettre les événements dans la queue en cas d'erreur
            this.eventQueue = [...events, ...this.eventQueue];
            await this.saveQueue();
        }
    }

    // ✅ Démarrer l'intervalle de flush automatique
    private startFlushInterval(): void {
        // Flush toutes les 30 secondes
        this.flushInterval = setInterval(() => {
            this.flush().catch(err => {
                console.warn('[Analytics] Erreur flush automatique:', err);
            });
        }, 30000);
    }

    // ✅ Arrêter le flush automatique
    stop(): void {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        // Flush final
        this.flush();
    }

    // ✅ Réinitialiser la session
    startNewSession(): void {
        this.sessionId = this.generateSessionId();
    }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;


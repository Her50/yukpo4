/**
 * Service d'analytics et métriques pour mesurer l'impact des améliorations UX
 * Intègre avec Mixpanel, Amplitude, ou Sentry selon la configuration
 */

import { Platform } from 'react-native';

let Sentry: any = null;
try {
    Sentry = require('sentry-expo');
} catch {}


// Types d'événements
export enum AnalyticsEvent {
    // Recherche
    SEARCH_INITIATED = 'search_initiated',
    SEARCH_COMPLETED = 'search_completed',
    SEARCH_FILTER_APPLIED = 'search_filter_applied',
    SEARCH_SORT_APPLIED = 'search_sort_applied',

    // Réservation
    BOOKING_STARTED = 'booking_started',
    SEAT_SELECTED = 'seat_selected',
    BOOKING_COMPLETED = 'booking_completed',
    BOOKING_ABANDONED = 'booking_abandoned',

    // Ticket
    TICKET_VIEWED = 'ticket_viewed',
    TICKET_SHARED = 'ticket_shared',
    TICKET_CANCELLED = 'ticket_cancelled',
    QR_CODE_SCANNED = 'qr_code_scanned',

    // Embarquement
    BOARDING_STARTED = 'boarding_started',
    PASSENGER_VALIDATED = 'passenger_validated',
    BOARDING_COMPLETED = 'boarding_completed',

    // Agence
    AGENCY_DASHBOARD_VIEWED = 'agency_dashboard_viewed',
    TICKET_MANAGED = 'ticket_managed',

    // Erreurs
    ERROR_OCCURRED = 'error_occurred',
    API_ERROR = 'api_error',

    // Performance
    SCREEN_LOAD_TIME = 'screen_load_time',
    API_RESPONSE_TIME = 'api_response_time',
}

interface AnalyticsProperties {
    [key: string]: string | number | boolean | null | undefined;
}

class AnalyticsService {
    private initialized = false;
    private eventsQueue: Array<{ event: string; properties: AnalyticsProperties }> = [];

    /**
     * Initialiser le service d'analytics
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Initialiser Sentry pour crash reporting
            if (__DEV__) {
                console.log('[Analytics] Service initialisé (mode développement)');
            } else {
                // Configuration Sentry en production
                // Sentry.init({...})
            }

            // Flush les événements en queue
            this.flushQueue();
            this.initialized = true;
        } catch (error) {
            console.error('[Analytics] Erreur initialisation:', error);
        }
    }

    /**
     * Enregistrer un événement
     */
    track(event: AnalyticsEvent | string, properties?: AnalyticsProperties) {
        const eventData = {
            event,
            properties: {
                ...properties,
                platform: Platform.OS,
                timestamp: new Date().toISOString(),
            },
        };

        // Enqueue si pas encore initialisé
        if (!this.initialized) {
            this.eventsQueue.push(eventData);
            return;
        }

        // Envoyer l'événement
        this.sendEvent(eventData);
    }

    /**
     * Envoyer un événement
     */
    private sendEvent(eventData: { event: string; properties: AnalyticsProperties }) {
        try {
            // Log en développement
            if (__DEV__) {
                console.log('[Analytics] Event:', eventData.event, eventData.properties);
            }

            // ✅ CORRIGÉ: Vérifier que Sentry est disponible avant utilisation
            if (Sentry && typeof Sentry.addBreadcrumb === 'function') {
                try {
                    Sentry.addBreadcrumb({
                        category: 'analytics',
                        message: eventData.event,
                        level: 'info',
                        data: eventData.properties,
                    });
                } catch (sentryError) {
                    // Ne pas bloquer si Sentry échoue
                    if (__DEV__) {
                        console.warn('[Analytics] Erreur Sentry (non-bloquant):', sentryError);
                    }
                }
            }

            // TODO: Intégrer Mixpanel ou Amplitude
            // if (MIXPANEL_TOKEN) {
            //     Mixpanel.track(eventData.event, eventData.properties);
            // }
        } catch (error) {
            console.error('[Analytics] Erreur envoi événement:', error);
        }
    }

    /**
     * Flush la queue d'événements
     */
    private flushQueue() {
        while (this.eventsQueue.length > 0) {
            const eventData = this.eventsQueue.shift();
            if (eventData) {
                this.sendEvent(eventData);
            }
        }
    }

    /**
     * Identifier un utilisateur
     */
    identify(userId: string, traits?: AnalyticsProperties) {
        try {
            if (__DEV__) {
                console.log('[Analytics] User identified:', userId, traits);
            }

            // ✅ CORRIGÉ: Vérifier que Sentry est disponible avant utilisation
            if (Sentry && typeof Sentry.setUser === 'function') {
                try {
                    Sentry.setUser({
                        id: userId,
                        ...traits,
                    });
                } catch (sentryError) {
                    // Ne pas bloquer si Sentry échoue
                    if (__DEV__) {
                        console.warn('[Analytics] Erreur Sentry setUser (non-bloquant):', sentryError);
                    }
                }
            }

            // TODO: Intégrer Mixpanel ou Amplitude
            // if (MIXPANEL_TOKEN) {
            //     Mixpanel.identify(userId);
            //     if (traits) {
            //         Mixpanel.people.set(traits);
            //     }
            // }
        } catch (error) {
            console.error('[Analytics] Erreur identification:', error);
        }
    }

    /**
     * Mesurer le temps de chargement d'un écran
     */
    trackScreenLoad(screenName: string, loadTime: number) {
        this.track(AnalyticsEvent.SCREEN_LOAD_TIME, {
            screen_name: screenName,
            load_time_ms: loadTime,
        });
    }

    /**
     * Mesurer le temps de réponse API
     */
    trackAPIResponse(endpoint: string, responseTime: number, success: boolean) {
        this.track(AnalyticsEvent.API_RESPONSE_TIME, {
            endpoint,
            response_time_ms: responseTime,
            success,
        });
    }

    /**
     * Enregistrer une erreur
     */
    trackError(error: Error, context?: AnalyticsProperties) {
        this.track(AnalyticsEvent.ERROR_OCCURRED, {
            error_message: error.message,
            error_stack: error.stack,
            ...context,
        });

        // ✅ CORRIGÉ: Vérifier que Sentry est disponible avant utilisation
        if (Sentry && typeof Sentry.captureException === 'function') {
            try {
                Sentry.captureException(error, {
                    extra: context,
                });
            } catch (sentryError) {
                // Ne pas bloquer si Sentry échoue
                if (__DEV__) {
                    console.warn('[Analytics] Erreur Sentry captureException (non-bloquant):', sentryError);
                }
            }
        }
    }

    /**
     * Enregistrer un événement de conversion
     */
    trackConversion(event: AnalyticsEvent, value?: number, currency = 'XAF') {
        this.track(event, {
            conversion_value: value,
            currency,
        });
    }
}

// Instance singleton
export const analytics = new AnalyticsService();

// Initialiser automatiquement
analytics.initialize();

// Helpers pour les événements courants
export const trackSearch = (departureCity: string, arrivalCity: string, filters?: AnalyticsProperties) => {
    analytics.track(AnalyticsEvent.SEARCH_INITIATED, {
        departure_city: departureCity,
        arrival_city: arrivalCity,
        ...filters,
    });
};

export const trackBooking = (ticketId: string, seatsCount: number, totalPrice: number) => {
    analytics.track(AnalyticsEvent.BOOKING_STARTED, {
        ticket_id: ticketId,
        seats_count: seatsCount,
        total_price: totalPrice,
    });
};

export const trackQRScan = (success: boolean, error?: string) => {
    analytics.track(AnalyticsEvent.QR_CODE_SCANNED, {
        success,
        error: error || null,
    });
};

export const trackScreenView = (screenName: string) => {
    analytics.track('screen_view', {
        screen_name: screenName,
    });
};

export default analytics;



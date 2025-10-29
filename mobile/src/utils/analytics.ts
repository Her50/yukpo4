/**
 * ✅ OPTIMISATION 6: Système d'Analytics pour tracking des interactions
 * Permet de mesurer l'usage de l'application et optimiser l'UX
 */

import { apiPost } from '../services/api';

// Types d'événements analytics
export type AnalyticsEventType =
    | 'category_filter_applied'
    | 'category_filter_reset'
    | 'product_view'
    | 'product_contact'
    | 'product_share'
    | 'product_gallery_view'
    | 'service_search'
    | 'search_query'
    | 'location_changed'
    | 'category_switched'
    | 'error_occurred'
    | 'filter_suggestion_applied'
    | 'filter_history_used';

export interface AnalyticsEvent {
    type: AnalyticsEventType;
    category?: string;
    timestamp: number;
    user_id?: string;
    session_id?: string;
    metadata?: Record<string, any>;
}

// Session ID unique pour chaque session
let currentSessionId: string | null = null;

/**
 * Génère un ID de session unique
 */
const generateSessionId = (): string => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Récupère l'ID de session courant (ou en crée un nouveau)
 */
export const getSessionId = (): string => {
    if (!currentSessionId) {
        currentSessionId = generateSessionId();
    }
    return currentSessionId;
};

/**
 * Log un événement analytics
 * @param eventType Type d'événement
 * @param metadata Données additionnelles
 */
export const logEvent = async (
    eventType: AnalyticsEventType,
    metadata: Record<string, any> = {}
): Promise<void> => {
    try {
        const event: AnalyticsEvent = {
            type: eventType,
            timestamp: Date.now(),
            session_id: getSessionId(),
            metadata,
        };

        // Ajouter la catégorie si fournie dans metadata
        if (metadata.category) {
            event.category = metadata.category;
        }

        // Logger en console en mode DEV
        if (__DEV__) {
            console.log(`📊 [Analytics] ${eventType}:`, {
                ...event,
                metadata,
            });
        }

        // Envoyer au backend (si disponible)
        try {
            await apiPost('/api/analytics/events', event);
        } catch (error) {
            // Ne pas bloquer l'app si l'analytics échoue
            if (__DEV__) {
                console.warn('[Analytics] Erreur envoi événement:', error);
            }
        }

        // ✅ OPTIONNEL: Sauvegarder localement en cas d'échec réseau
        // (à implémenter si besoin avec AsyncStorage)
    } catch (error) {
        console.error('[Analytics] Erreur logEvent:', error);
    }
};

/**
 * Track l'application de filtres de catégorie
 */
export const trackCategoryFilter = async (
    category: string,
    filters: Record<string, any>,
    resultsCount: number
): Promise<void> => {
    await logEvent('category_filter_applied', {
        category,
        filters: Object.keys(filters),
        filters_count: Object.keys(filters).length,
        results_count: resultsCount,
    });
};

/**
 * Track la visualisation d'un produit
 */
export const trackProductView = async (
    productId: string,
    productType: string,
    category: string,
    prestataireId?: string
): Promise<void> => {
    await logEvent('product_view', {
        product_id: productId,
        product_type: productType,
        category,
        prestataire_id: prestataireId,
    });
};

/**
 * Track un contact avec un prestataire
 */
export const trackProductContact = async (
    productId: string,
    category: string,
    contactType: 'message' | 'call' | 'whatsapp',
    prestataireId?: string
): Promise<void> => {
    await logEvent('product_contact', {
        product_id: productId,
        category,
        contact_type: contactType,
        prestataire_id: prestataireId,
    });
};

/**
 * Track le partage d'un produit
 */
export const trackProductShare = async (
    productId: string,
    category: string,
    shareMethod?: string
): Promise<void> => {
    await logEvent('product_share', {
        product_id: productId,
        category,
        share_method: shareMethod,
    });
};

/**
 * Track l'application d'une suggestion de filtre
 */
export const trackFilterSuggestion = async (
    category: string,
    suggestionId: string,
    suggestionLabel: string
): Promise<void> => {
    await logEvent('filter_suggestion_applied', {
        category,
        suggestion_id: suggestionId,
        suggestion_label: suggestionLabel,
    });
};

/**
 * Track l'utilisation de l'historique de filtres
 */
export const trackFilterHistory = async (
    category: string,
    filtersCount: number
): Promise<void> => {
    await logEvent('filter_history_used', {
        category,
        filters_count: filtersCount,
    });
};

/**
 * Track une recherche
 */
export const trackSearch = async (
    query: string,
    category?: string,
    resultsCount?: number
): Promise<void> => {
    await logEvent('search_query', {
        query,
        category,
        results_count: resultsCount,
        query_length: query.length,
    });
};

/**
 * Track un changement de catégorie
 */
export const trackCategorySwitch = async (
    fromCategory: string,
    toCategory: string
): Promise<void> => {
    await logEvent('category_switched', {
        from_category: fromCategory,
        to_category: toCategory,
    });
};

/**
 * Track une erreur
 */
export const trackError = async (
    error: Error,
    context: string,
    metadata?: Record<string, any>
): Promise<void> => {
    await logEvent('error_occurred', {
        error_message: error.message,
        error_stack: error.stack,
        context,
        ...metadata,
    });
};

/**
 * Reset la session (appelé lors de la déconnexion ou après X minutes d'inactivité)
 */
export const resetSession = (): void => {
    currentSessionId = null;
};


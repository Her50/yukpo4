/**
 * Service de tracking des métriques UX pour Prometheus
 * Envoie les événements au backend qui les expose via /metrics
 */

const API_BASE = import.meta.env.VITE_API_URL || 'https://yukpomnang.onrender.com';

/**
 * Tracker un événement de scroll sur un carrousel de produits
 */
export const trackProductCarousel = async (
    action: 'scroll' | 'auto_scroll' | 'view' | 'click' | 'pause' | 'resume',
    carouselId: string,
    itemId?: string
): Promise<void> => {
    try {
        await fetch(`${API_BASE}/api/metrics/track/product-carousel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                carousel_id: carouselId,
                action,
                item_id: itemId,
            }),
            keepalive: true, // Envoi même si la page se ferme
        });
    } catch (error) {
        // Silent fail - ne pas bloquer l'UI
        if (import.meta.env.DEV) {
            console.warn('[MetricsTracking] Erreur tracking produit:', error);
        }
    }
};

/**
 * Tracker un événement de scroll sur un carrousel de vidéos
 */
export const trackVideoCarousel = async (
    action: 'scroll' | 'auto_scroll' | 'view' | 'play' | 'pause' | 'engagement',
    carouselId: string,
    videoId?: string,
    engagementType?: 'like' | 'share' | 'comment'
): Promise<void> => {
    try {
        await fetch(`${API_BASE}/api/metrics/track/video-carousel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                carousel_id: carouselId,
                action,
                video_id: videoId,
                engagement_type: engagementType,
            }),
            keepalive: true,
        });
    } catch (error) {
        if (import.meta.env.DEV) {
            console.warn('[MetricsTracking] Erreur tracking vidéo:', error);
        }
    }
};

/**
 * Tracker un événement de navigation dans ResultatBesoinScreen
 */
export const trackNavigation = async (
    action: 'view' | 'search' | 'filter' | 'click' | 'geolocation_search' | 'map_interaction',
    options?: {
        queryType?: 'keyword' | 'category' | 'location';
        filterType?: 'price' | 'category' | 'location' | 'rating';
        itemType?: 'service' | 'product';
        itemId?: string;
        resultsCount?: number;
        hasResults?: boolean;
        mapAction?: 'zoom' | 'pan' | 'marker_click';
    }
): Promise<void> => {
    try {
        await fetch(`${API_BASE}/api/metrics/track/navigation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                query_type: options?.queryType,
                filter_type: options?.filterType,
                item_type: options?.itemType,
                item_id: options?.itemId,
                results_count: options?.resultsCount,
                has_results: options?.hasResults,
                map_action: options?.mapAction,
            }),
            keepalive: true,
        });
    } catch (error) {
        if (import.meta.env.DEV) {
            console.warn('[MetricsTracking] Erreur tracking navigation:', error);
        }
    }
};

/**
 * Tracker un événement de chat
 * Note: Les métriques de chat sont aussi trackées automatiquement côté backend
 * Cette fonction permet de tracker des événements spécifiques côté frontend
 */
export const trackChatEvent = async (
    action: 'message_sent' | 'message_read' | 'conversation_opened' | 'conversation_closed'
): Promise<void> => {
    // Les métriques chat sont principalement trackées côté backend
    // Cette fonction peut être étendue pour tracker des événements frontend spécifiques
    if (import.meta.env.DEV) {
        console.debug('[MetricsTracking] Chat event:', action);
    }
};

/**
 * Hook React pour tracker le scroll avec throttling
 */
export const useScrollTracking = (
    callback: () => void,
    throttleMs: number = 1000
) => {
    let lastCall = 0;

    return () => {
        const now = Date.now();
        if (now - lastCall >= throttleMs) {
            lastCall = now;
            callback();
        }
    };
};



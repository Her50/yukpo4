/**
 * Service de tracking des métriques UX pour Prometheus (Mobile)
 * Envoie les événements au backend qui les expose via /metrics
 */

import { API_BASE_URL } from '../config/api.config';

/**
 * Tracker un événement de scroll sur un carrousel de produits
 */
export const trackProductCarousel = async (
    action: 'scroll' | 'auto_scroll' | 'view' | 'click' | 'pause' | 'resume',
    carouselId: string,
    itemId?: string
): Promise<void> => {
    try {
        await fetch(`${API_BASE_URL}/api/metrics/track/product-carousel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                carousel_id: carouselId,
                action,
                item_id: itemId,
            }),
        });
    } catch (error) {
        // Silent fail - ne pas bloquer l'UI
        if (__DEV__) {
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
        await fetch(`${API_BASE_URL}/api/metrics/track/video-carousel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                carousel_id: carouselId,
                action,
                video_id: videoId,
                engagement_type: engagementType,
            }),
        });
    } catch (error) {
        if (__DEV__) {
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
        await fetch(`${API_BASE_URL}/api/metrics/track/navigation`, {
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
        });
    } catch (error) {
        if (__DEV__) {
            console.warn('[MetricsTracking] Erreur tracking navigation:', error);
        }
    }
};

/**
 * Tracker un événement de chat
 */
export const trackChatEvent = async (
    action: 'message_sent' | 'message_read' | 'conversation_opened' | 'conversation_closed'
): Promise<void> => {
    // Les métriques chat sont principalement trackées côté backend
    if (__DEV__) {
        console.debug('[MetricsTracking] Chat event:', action);
    }
};



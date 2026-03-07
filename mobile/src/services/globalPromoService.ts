import { apiGet, apiPost } from './api';

export interface GlobalPromoEvent {
    id: string;
    slug: string;
    theme: string;
    displayName: string;
    description?: string;
    startsAt: string;
    endsAt: string;
    recurrenceRule?: string;
    status: 'draft' | 'scheduled' | 'live' | 'archived';
    config?: Record<string, unknown>;
    createdByUserId?: number;
    createdAt: string;
    updatedAt: string;
}

export interface GlobalPromoEntry {
    id: string;
    eventId: string;
    serviceId: number;
    liveSessionId?: string | null;
    submittedByUserId?: number;
    discountPercentage?: number | null;
    promoPriceCfa?: number | null;
    stockCap?: number | null;
    availability: 'online' | 'live' | 'both';
    status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published' | 'ended';
    metadata?: Record<string, unknown>;
    publishedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface GlobalPromoProductSnapshot {
    id: string;
    promoEntryId: string;
    availability: 'online' | 'live' | 'both';
    snapshot: Record<string, unknown>;
    priorityScore: number;
    highlighted: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface GlobalPromoCatalogItem {
    event: GlobalPromoEvent;
    entry: GlobalPromoEntry;
    product?: GlobalPromoProductSnapshot;
    badges?: {
        eventIsLive: boolean;
        eventIsImminent: boolean;
    };
}

export interface GlobalPromoCatalogPage {
    items: GlobalPromoCatalogItem[];
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
}

interface ApiResponse<T> {
    success?: boolean;
    data?: T;
    message?: string;
    error?: string;
}

/**
 * Récupère le catalogue des promotions globales (Black Friday, etc.)
 */
export const fetchGlobalPromoCatalog = async (params?: {
    page?: number;
    pageSize?: number;
    highlightedOnly?: boolean;
    eventSlug?: string;
    availability?: 'online' | 'live' | 'both';
    status?: string;
    search?: string;
    sort?: 'priority' | 'ending_soon' | 'recent' | 'newest_event';
    startsWithinMinutes?: number;
}): Promise<GlobalPromoCatalogPage> => {
    try {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.pageSize) searchParams.set('page_size', String(params.pageSize));
        if (params?.highlightedOnly) searchParams.set('highlighted_only', 'true');
        if (params?.eventSlug) searchParams.set('event_slug', params.eventSlug);
        if (params?.availability) searchParams.set('availability', params.availability);
        if (params?.status) searchParams.set('status', params.status);
        if (params?.search) searchParams.set('search', params.search);
        if (params?.sort) searchParams.set('sort', params.sort);
        if (params?.startsWithinMinutes)
            searchParams.set('starts_within_minutes', String(params.startsWithinMinutes));

        const query = searchParams.toString();
        const url = query ? `/api/global-promos/catalog?${query}` : '/api/global-promos/catalog';

        const response = await apiGet<ApiResponse<GlobalPromoCatalogPage>>(url);
        const payload = response.data || response;

        // ✅ CORRIGÉ: Gestion robuste des erreurs et réponses invalides
        if (payload && typeof payload === 'object') {
            if ('success' in payload && payload.success === false) {
                // ✅ CORRIGÉ: payload.error peut être un objet {code, message} ou une string
                let errorMessage: string;
                if (typeof payload.error === 'object' && payload.error !== null) {
                    errorMessage = (payload.error as any).message || (payload.error as any).code || JSON.stringify(payload.error);
                } else {
                    errorMessage = (payload.error as string) || payload.message || 'Erreur lors de la récupération du catalogue';
                }
                throw new Error(errorMessage);
            }
            if ('data' in payload && payload.data) {
                return payload.data as GlobalPromoCatalogPage;
            }
            // Si payload est directement un GlobalPromoCatalogPage
            if ('items' in payload && Array.isArray(payload.items)) {
                return payload as GlobalPromoCatalogPage;
            }
        }

        // Fallback: retourner une page vide
        return { items: [], page: 1, pageSize: 24, total: 0, hasMore: false };
    } catch (error: any) {
        console.error('[globalPromoService] Erreur fetchGlobalPromoCatalog:', error);
        // ✅ CORRIGÉ: S'assurer de toujours retourner un objet valide même en cas d'erreur
        const errorMessage = error?.message || error?.toString() || 'Erreur inconnue';
        throw new Error(errorMessage);
    }
};

/**
 * Récupère la liste des événements de promotion globale
 */
export const fetchGlobalPromoEvents = async (includeArchived: boolean = false): Promise<GlobalPromoEvent[]> => {
    try {
        const query = includeArchived ? '?include_archived=true' : '';
        const response = await apiGet<ApiResponse<GlobalPromoEvent[]>>(`/api/global-promos/events${query}`);
        const payload = response.data || response;
        if (payload.success === false) {
            const errMsg = typeof payload.error === 'object' && payload.error !== null
                ? (payload.error as any).message || JSON.stringify(payload.error)
                : (payload.error as string) || payload.message || 'Erreur lors de la récupération des événements';
            throw new Error(errMsg);
        }
        return (payload.data || []) as GlobalPromoEvent[];
    } catch (error: any) {
        console.error('[globalPromoService] Erreur fetchGlobalPromoEvents:', error);
        throw error;
    }
};

/**
 * Récupère les événements et entrées du prestataire connecté (authentifié)
 */
export const fetchMyGlobalPromoEvents = async (): Promise<{ events: any[]; entries: any[] }> => {
    try {
        const response = await apiGet<any>('/api/me/global-promos/events');
        const payload = response.data || response;
        if (payload.success === false) {
            const errMsg = typeof payload.error === 'object' && payload.error !== null
                ? (payload.error as any).message || JSON.stringify(payload.error)
                : (payload.error as string) || payload.message || 'Erreur lors de la récupération';
            throw new Error(errMsg);
        }
        const data = payload.data || payload;
        return {
            events: Array.isArray(data.events) ? data.events : [],
            entries: Array.isArray(data.entries) ? data.entries : [],
        };
    } catch (error: any) {
        console.error('[globalPromoService] Erreur fetchMyGlobalPromoEvents:', error);
        throw error;
    }
};

/**
 * Soumet une entrée de promotion globale
 */
export const submitGlobalPromoEntry = async (
    eventId: string,
    payload: {
        serviceId: number;
        discountPercentage?: number;
        promoPriceCfa?: number;
        stockCap?: number;
        availability?: 'online' | 'live' | 'both';
        metadata?: Record<string, unknown>;
    }
): Promise<GlobalPromoEntry> => {
    try {
        // ✅ CORRIGÉ: Convertir camelCase → snake_case pour le backend Rust
        const backendPayload: Record<string, any> = {
            service_id: payload.serviceId,
            availability: payload.availability || 'online',
        };
        if (payload.discountPercentage !== undefined) backendPayload.discount_percentage = payload.discountPercentage;
        if (payload.promoPriceCfa !== undefined) backendPayload.promo_price_cfa = payload.promoPriceCfa;
        if (payload.stockCap !== undefined) backendPayload.stock_cap = payload.stockCap;
        if (payload.metadata !== undefined) backendPayload.metadata = payload.metadata;

        const response = await apiPost<ApiResponse<GlobalPromoEntry>>(
            `/api/me/global-promos/events/${eventId}/entries`,
            backendPayload
        );
        const payloadResponse = response.data || response;
        if (payloadResponse.success === false) {
            const errMsg = typeof payloadResponse.error === 'object' && payloadResponse.error !== null
                ? (payloadResponse.error as any).message || JSON.stringify(payloadResponse.error)
                : (payloadResponse.error as string) || payloadResponse.message || 'Erreur lors de la soumission';
            throw new Error(errMsg);
        }
        if (!payloadResponse.data) {
            throw new Error('Réponse invalide');
        }
        return payloadResponse.data as GlobalPromoEntry;
    } catch (error: any) {
        console.error('[globalPromoService] Erreur submitGlobalPromoEntry:', error);
        throw error;
    }
};

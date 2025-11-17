import type { GlobalPromoCatalogItem, GlobalPromoEvent, SubmitGlobalPromoEntryPayload } from '../types/GlobalPromo';
import { apiGet, apiPost } from './api';

interface CatalogResponse {
    success?: boolean;
    data?: any[];
    message?: string;
}

const mapCatalogItem = (raw: any): GlobalPromoCatalogItem => ({
    event: {
        id: raw.event?.id ?? raw.event_id ?? raw.eventId,
        slug: raw.event?.slug ?? raw.slug,
        theme: raw.event?.theme ?? raw.theme ?? 'black_friday',
        displayName: raw.event?.display_name ?? raw.event?.displayName ?? raw.display_name ?? '',
        description: raw.event?.description ?? raw.description,
        startsAt: raw.event?.starts_at ?? raw.starts_at ?? new Date().toISOString(),
        endsAt: raw.event?.ends_at ?? raw.ends_at ?? new Date().toISOString(),
        status: raw.event?.status ?? raw.status ?? 'scheduled',
        config: raw.event?.config ?? raw.config ?? {},
    },
    entry: {
        id: raw.entry?.id ?? raw.entry_id ?? raw.id,
        eventId: raw.entry?.event_id ?? raw.event_id ?? raw.event?.id ?? '',
        serviceId: raw.entry?.service_id ?? raw.service_id ?? 0,
        discountPercentage:
            raw.entry?.discount_percentage ?? raw.discount_percentage ?? raw.discountPercentage,
        promoPriceCfa: raw.entry?.promo_price_cfa ?? raw.promo_price_cfa ?? raw.promoPriceCfa,
        availability: raw.entry?.availability ?? raw.availability ?? 'online',
        status: raw.entry?.status ?? raw.status ?? 'approved',
        metadata: raw.entry?.metadata ?? raw.metadata ?? {},
    },
    product: raw.product
        ? {
            id: raw.product.id,
            promoEntryId: raw.product.promo_entry_id ?? raw.product.promoEntryId ?? raw.entry?.id,
            availability: raw.product.availability ?? raw.entry?.availability ?? 'online',
            snapshot: raw.product.snapshot ?? raw.product,
            priorityScore: raw.product.priority_score ?? raw.product.priorityScore ?? 0,
            highlighted: Boolean(raw.product.highlighted),
        }
        : undefined,
});

export const fetchGlobalPromoCatalog = async (): Promise<GlobalPromoCatalogItem[]> => {
    try {
        const response = await apiGet<CatalogResponse>('/api/global-promos/catalog');
        if (!response.success || !response.data) {
            return [];
        }
        // Vérifier que response.data est bien un tableau
        if (!Array.isArray(response.data)) {
            console.warn('[fetchGlobalPromoCatalog] response.data n\'est pas un tableau:', response.data);
            return [];
        }
        return response.data.map(mapCatalogItem);
    } catch (error) {
        console.error('[fetchGlobalPromoCatalog] Erreur lors de la récupération du catalogue:', error);
        return [];
    }
};

interface MyEventsResponse {
    events: any[];
    entries: any[];
}

const mapEvent = (raw: any): GlobalPromoEvent => ({
    id: raw.id,
    slug: raw.slug,
    theme: raw.theme,
    displayName: raw.display_name ?? raw.displayName ?? '',
    description: raw.description,
    startsAt: raw.starts_at ?? raw.startsAt ?? new Date().toISOString(),
    endsAt: raw.ends_at ?? raw.endsAt ?? new Date().toISOString(),
    status: raw.status,
    config: raw.config ?? {},
});

const mapEntry = (raw: any): GlobalPromoCatalogItem['entry'] => ({
    id: raw.id,
    eventId: raw.event_id ?? raw.eventId,
    serviceId: raw.service_id ?? raw.serviceId,
    availability: raw.availability ?? 'online',
    status: raw.status ?? 'pending_review',
    discountPercentage: raw.discount_percentage ?? raw.discountPercentage,
    promoPriceCfa: raw.promo_price_cfa ?? raw.promoPriceCfa,
    metadata: raw.metadata ?? {},
});

export const fetchMyGlobalPromoEvents = async (): Promise<{
    events: GlobalPromoEvent[];
    entries: GlobalPromoCatalogItem['entry'][];
}> => {
    const response = await apiGet<{ data?: MyEventsResponse; success?: boolean }>('/api/me/global-promos/events');
    if (!response.success || !response.data) {
        return { events: [], entries: [] };
    }
    return {
        events: (response.data.events ?? []).map(mapEvent),
        entries: (response.data.entries ?? []).map(mapEntry),
    };
};

export const submitGlobalPromoEntry = async (
    eventId: string,
    payload: SubmitGlobalPromoEntryPayload,
) => {
    return apiPost(`/api/me/global-promos/events/${eventId}/entries`, payload);
};


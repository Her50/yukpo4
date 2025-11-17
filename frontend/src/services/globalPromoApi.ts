import type {
    BulkReviewGlobalPromoEntryPayload,
    CreateGlobalPromoEventPayload,
    GlobalPromoCatalogItem,
    GlobalPromoCatalogPage,
    GlobalPromoEntry,
    GlobalPromoEvent,
    GlobalPromoProductSnapshot,
    ReviewGlobalPromoEntryPayload,
    UpdateGlobalPromoEventPayload,
    UpsertGlobalPromoEntryPayload,
} from '@/types/globalPromo';
import { apiGet, apiPost, apiPut } from './apiService';

interface ApiResponse<T> {
    success?: boolean;
    data?: T;
    message?: string;
}

const mapEvent = (raw: any): GlobalPromoEvent => ({
    id: raw.id,
    slug: raw.slug,
    theme: raw.theme,
    displayName: raw.display_name ?? raw.displayName ?? '',
    description: raw.description,
    startsAt: raw.starts_at ?? raw.startsAt,
    endsAt: raw.ends_at ?? raw.endsAt,
    recurrenceRule: raw.recurrence_rule ?? raw.recurrenceRule,
    status: raw.status,
    config: raw.config ?? {},
    createdByUserId: raw.created_by_user_id ?? raw.createdByUserId,
    createdAt: raw.created_at ?? raw.createdAt,
    updatedAt: raw.updated_at ?? raw.updatedAt,
});

const mapEntry = (raw: any): GlobalPromoEntry => ({
    id: raw.id,
    eventId: raw.event_id ?? raw.eventId,
    serviceId: raw.service_id ?? raw.serviceId,
    liveSessionId: raw.live_session_id ?? raw.liveSessionId,
    submittedByUserId: raw.submitted_by_user_id ?? raw.submittedByUserId,
    discountPercentage: raw.discount_percentage ?? raw.discountPercentage,
    promoPriceCfa: raw.promo_price_cfa ?? raw.promoPriceCfa,
    stockCap: raw.stock_cap ?? raw.stockCap,
    availability: raw.availability,
    status: raw.status,
    metadata: raw.metadata ?? {},
    publishedAt: raw.published_at ?? raw.publishedAt,
    createdAt: raw.created_at ?? raw.createdAt,
    updatedAt: raw.updated_at ?? raw.updatedAt,
});

const mapProduct = (raw?: any): GlobalPromoProductSnapshot | undefined => {
    if (!raw || !raw.id) return undefined;
    return {
        id: raw.id,
        promoEntryId: raw.promo_entry_id ?? raw.promoEntryId,
        availability: raw.availability,
        snapshot: raw.snapshot ?? {},
        priorityScore: raw.priority_score ?? raw.priorityScore ?? 0,
        highlighted: Boolean(raw.highlighted),
        createdAt: raw.created_at ?? raw.createdAt,
        updatedAt: raw.updated_at ?? raw.updatedAt,
    };
};

const mapCatalogItem = (raw: any): GlobalPromoCatalogItem => {
    const base: GlobalPromoCatalogItem = {
        event: mapEvent(raw.event ?? raw),
        entry: mapEntry(raw.entry ?? raw),
        product: mapProduct(raw.product ?? raw.product_snapshot),
    };

    const badgesRaw = raw.badges;
    if (!badgesRaw) return base;

    return {
        ...base,
        badges: {
            eventIsLive: badgesRaw.event_is_live ?? badgesRaw.eventIsLive ?? false,
            eventIsImminent: badgesRaw.event_is_imminent ?? badgesRaw.eventIsImminent ?? false,
        },
    };
};

const extractData = async <T>(response: Response): Promise<T> => {
    const payload: ApiResponse<T> = await response.json();
    if (payload.data === undefined) {
        throw new Error(payload.message || 'Réponse API invalide');
    }
    return payload.data;
};

export const fetchGlobalPromoEvents = async (
    includeArchived = false,
): Promise<GlobalPromoEvent[]> => {
    const query = includeArchived ? '?include_archived=true' : '';
    const response = await apiGet(`/api/global-promos/events${query}`);
    const data = await extractData<any[]>(response);
    return data.map(mapEvent);
};

export const createGlobalPromoEvent = async (
    payload: CreateGlobalPromoEventPayload,
): Promise<GlobalPromoEvent> => {
    const response = await apiPost('/api/global-promos/events', payload);
    const data = await extractData<any>(response);
    return mapEvent(data);
};

export const updateGlobalPromoEvent = async (
    eventId: string,
    payload: UpdateGlobalPromoEventPayload,
): Promise<GlobalPromoEvent> => {
    const response = await apiPut(`/api/global-promos/events/${eventId}`, payload);
    const data = await extractData<any>(response);
    return mapEvent(data);
};

export const fetchGlobalPromoEntries = async (
    eventId: string,
): Promise<GlobalPromoEntry[]> => {
    const response = await apiGet(`/api/global-promos/events/${eventId}/entries`);
    const data = await extractData<any[]>(response);
    return data.map(mapEntry);
};

export const upsertGlobalPromoEntry = async (
    eventId: string,
    payload: UpsertGlobalPromoEntryPayload,
): Promise<GlobalPromoEntry> => {
    const response = await apiPost(`/api/global-promos/events/${eventId}/entries`, payload);
    const data = await extractData<any>(response);
    return mapEntry(data);
};

export const fetchGlobalPromoCatalog = async (
    params?: {
        page?: number;
        pageSize?: number;
        highlightedOnly?: boolean;
        eventSlug?: string;
        availability?: 'online' | 'live' | 'both';
        status?: string;
        search?: string;
        sort?: 'priority' | 'ending_soon' | 'recent' | 'newest_event';
        startsWithinMinutes?: number;
    },
): Promise<GlobalPromoCatalogPage> => {
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

    const response = await apiGet(url);
    const data = await extractData<any>(response);

    const items = (data.items ?? []).map(mapCatalogItem);
    const page = data.page ?? 1;
    const pageSize = data.page_size ?? data.pageSize ?? items.length;
    const total = data.total ?? items.length;
    const hasMore = data.has_more ?? data.hasMore ?? false;

    return {
        items,
        page,
        pageSize,
        total,
        hasMore,
    };
};

interface MyEventsPayload {
    events: any[];
    entries: any[];
}

export const fetchMyGlobalPromoEvents = async (): Promise<{
    events: GlobalPromoEvent[];
    entries: GlobalPromoEntry[];
}> => {
    const response = await apiGet('/api/me/global-promos/events');
    const data = await extractData<MyEventsPayload>(response);
    return {
        events: (data.events ?? []).map(mapEvent),
        entries: (data.entries ?? []).map(mapEntry),
    };
};

export const fetchMyGlobalPromoEntries = async (): Promise<GlobalPromoEntry[]> => {
    const response = await apiGet('/api/me/global-promos/entries');
    const data = await extractData<any[]>(response);
    return data.map(mapEntry);
};

export const submitMyGlobalPromoEntry = async (
    eventId: string,
    payload: UpsertGlobalPromoEntryPayload,
): Promise<GlobalPromoEntry> => {
    const response = await apiPost(`/api/me/global-promos/events/${eventId}/entries`, payload);
    const data = await extractData<any>(response);
    return mapEntry(data);
};

export const reviewGlobalPromoEntry = async (
    entryId: string,
    payload: ReviewGlobalPromoEntryPayload,
): Promise<GlobalPromoEntry> => {
    const response = await apiPost(`/api/global-promos/entries/${entryId}/review`, {
        status: payload.status,
        message: payload.message,
        highlighted: payload.highlighted,
        priority_score: payload.priorityScore,
        metadata_patch: payload.metadataPatch,
    });
    const data = await extractData<any>(response);
    return mapEntry(data);
};

export const reviewGlobalPromoEntriesBulk = async (
    payload: BulkReviewGlobalPromoEntryPayload,
): Promise<GlobalPromoEntry[]> => {
    const response = await apiPost('/api/global-promos/entries/bulk-review', {
        entry_ids: payload.entryIds,
        status: payload.status,
        message: payload.message,
        highlighted: payload.highlighted,
        priority_score: payload.priorityScore,
        metadata_patch: payload.metadataPatch,
    });
    const data = await extractData<any[]>(response);
    return data.map(mapEntry);
};


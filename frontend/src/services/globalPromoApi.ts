import type {
    CreateGlobalPromoEventPayload,
    GlobalPromoCatalogItem,
    GlobalPromoEntry,
    GlobalPromoEvent,
    GlobalPromoProductSnapshot,
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

const mapCatalogItem = (raw: any): GlobalPromoCatalogItem => ({
    event: mapEvent(raw.event ?? raw),
    entry: mapEntry(raw.entry ?? raw),
    product: mapProduct(raw.product ?? raw.product_snapshot),
});

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

export const fetchGlobalPromoCatalog = async (): Promise<GlobalPromoCatalogItem[]> => {
    const response = await apiGet('/api/global-promos/catalog');
    const data = await extractData<any[]>(response);
    return data.map(mapCatalogItem);
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


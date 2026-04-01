import type {
    BulkReviewGlobalPromoEntryPayload,
    CreateGlobalPromoEventPayload,
    GlobalPromoEntry,
    GlobalPromoEvent,
    ReviewGlobalPromoEntryPayload,
    UpsertGlobalPromoEntryPayload,
} from '../types/GlobalPromo';
import { apiGet, apiPost } from './api';

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

export const fetchGlobalPromoEvents = async (includeArchived = false): Promise<GlobalPromoEvent[]> => {
    const query = includeArchived ? '?include_archived=true' : '';
    const response = await apiGet<GlobalPromoEvent[]>(`/api/global-promos/events${query}`);
    // Accepter les deux formes : { success, data: [...] } ou directement [...]
    if (Array.isArray(response.data)) {
        return response.data.map(mapEvent);
    }
    if (Array.isArray(response)) {
        return (response as unknown as any[]).map(mapEvent);
    }
    return [];
};

export const createGlobalPromoEvent = async (payload: CreateGlobalPromoEventPayload): Promise<GlobalPromoEvent> => {
    // ✅ CORRIGÉ: Convertir camelCase → snake_case pour le backend Rust
    const backendPayload: Record<string, any> = {
        slug: payload.slug,
        theme: payload.theme,
        display_name: payload.displayName,
        starts_at: payload.startsAt,
        ends_at: payload.endsAt,
    };
    if (payload.description !== undefined) backendPayload.description = payload.description;
    if (payload.recurrenceRule !== undefined) backendPayload.recurrence_rule = payload.recurrenceRule;
    if (payload.config !== undefined) backendPayload.config = payload.config;

    const response = await apiPost<GlobalPromoEvent>('/api/global-promos/events', backendPayload);
    if (response.success && response.data) {
        return mapEvent(response.data);
    }
    const errMsg = typeof response.error === 'object' && response.error !== null
        ? (response.error as any).message || JSON.stringify(response.error)
        : response.error || 'Impossible de créer la campagne';
    throw new Error(errMsg);
};

export const fetchGlobalPromoEntries = async (eventId: string): Promise<GlobalPromoEntry[]> => {
    const response = await apiGet<GlobalPromoEntry[]>(`/api/global-promos/events/${eventId}/entries`);
    // Accepter les deux formes : { success, data: [...] } ou directement [...]
    if (Array.isArray(response.data)) {
        return response.data.map(mapEntry);
    }
    if (Array.isArray(response)) {
        return (response as unknown as any[]).map(mapEntry);
    }
    return [];
};

export const upsertGlobalPromoEntry = async (
    eventId: string,
    payload: UpsertGlobalPromoEntryPayload,
): Promise<GlobalPromoEntry> => {
    // ✅ CORRIGÉ: Convertir camelCase → snake_case pour le backend Rust
    const backendPayload: Record<string, any> = {
        service_id: payload.serviceId,
        availability: payload.availability || 'online',
    };
    if (payload.liveSessionId !== undefined) backendPayload.live_session_id = payload.liveSessionId;
    if (payload.discountPercentage !== undefined) backendPayload.discount_percentage = payload.discountPercentage;
    if (payload.promoPriceCfa !== undefined) backendPayload.promo_price_cfa = payload.promoPriceCfa;
    if (payload.stockCap !== undefined) backendPayload.stock_cap = payload.stockCap;
    if (payload.status !== undefined) backendPayload.status = payload.status;
    if (payload.metadata !== undefined) backendPayload.metadata = payload.metadata;
    if (payload.highlighted !== undefined) backendPayload.highlighted = payload.highlighted;
    if (payload.priorityScore !== undefined) backendPayload.priority_score = payload.priorityScore;
    if (payload.snapshot !== undefined) backendPayload.snapshot = payload.snapshot;

    const response = await apiPost<GlobalPromoEntry>(`/api/global-promos/events/${eventId}/entries`, backendPayload);
    if (response.success && response.data) {
        return mapEntry(response.data);
    }
    const errMsg = typeof response.error === 'object' && response.error !== null
        ? (response.error as any).message || JSON.stringify(response.error)
        : response.error || 'Impossible de créer/mettre à jour l\'entrée';
    throw new Error(errMsg);
};

export const reviewGlobalPromoEntry = async (
    entryId: string,
    payload: ReviewGlobalPromoEntryPayload,
): Promise<GlobalPromoEntry> => {
    const response = await apiPost<GlobalPromoEntry>(`/api/global-promos/entries/${entryId}/review`, {
        status: payload.status,
        message: payload.message,
        highlighted: payload.highlighted,
        priority_score: payload.priorityScore,
        metadata_patch: payload.metadataPatch,
    });
    if (response.success && response.data) {
        return mapEntry(response.data);
    }
    const errMsg = typeof response.error === 'object' && response.error !== null
        ? (response.error as any).message || JSON.stringify(response.error)
        : response.error || 'Impossible de réviser l\'entrée';
    throw new Error(errMsg);
};

export const reviewGlobalPromoEntriesBulk = async (
    payload: BulkReviewGlobalPromoEntryPayload,
): Promise<GlobalPromoEntry[]> => {
    const response = await apiPost<GlobalPromoEntry[]>('/api/global-promos/entries/bulk-review', {
        entry_ids: payload.entryIds,
        status: payload.status,
        message: payload.message,
        highlighted: payload.highlighted,
        priority_score: payload.priorityScore,
        metadata_patch: payload.metadataPatch,
    });
    if (response.success && Array.isArray(response.data)) {
        return response.data.map(mapEntry);
    }
    const errMsg = typeof response.error === 'object' && response.error !== null
        ? (response.error as any).message || JSON.stringify(response.error)
        : response.error || 'Impossible de réviser les entrées en masse';
    throw new Error(errMsg);
};


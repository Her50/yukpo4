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
    if (response.success && Array.isArray(response.data)) {
        return response.data.map(mapEvent);
    }
    return [];
};

export const createGlobalPromoEvent = async (payload: CreateGlobalPromoEventPayload): Promise<GlobalPromoEvent> => {
    const response = await apiPost<GlobalPromoEvent>('/api/global-promos/events', payload);
    if (response.success && response.data) {
        return mapEvent(response.data);
    }
    throw new Error(response.error || 'Impossible de créer la campagne');
};

export const fetchGlobalPromoEntries = async (eventId: string): Promise<GlobalPromoEntry[]> => {
    const response = await apiGet<GlobalPromoEntry[]>(`/api/global-promos/events/${eventId}/entries`);
    if (response.success && Array.isArray(response.data)) {
        return response.data.map(mapEntry);
    }
    return [];
};

export const upsertGlobalPromoEntry = async (
    eventId: string,
    payload: UpsertGlobalPromoEntryPayload,
): Promise<GlobalPromoEntry> => {
    const response = await apiPost<GlobalPromoEntry>(`/api/global-promos/events/${eventId}/entries`, payload);
    if (response.success && response.data) {
        return mapEntry(response.data);
    }
    throw new Error(response.error || 'Impossible de créer/mettre à jour l\'entrée');
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
    throw new Error(response.error || 'Impossible de réviser l\'entrée');
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
    throw new Error(response.error || 'Impossible de réviser les entrées en masse');
};


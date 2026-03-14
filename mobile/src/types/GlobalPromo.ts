export type GlobalPromoStatus =
    | 'draft'
    | 'scheduled'
    | 'live'
    | 'pending_review'
    | 'approved'
    | 'published'
    | 'rejected'
    | 'ended'
    | 'archived';

export interface GlobalPromoEvent {
    id: string;
    slug: string;
    theme: string;
    displayName: string;
    description?: string | null;
    startsAt: string;
    endsAt: string;
    recurrenceRule?: string | null;
    status: GlobalPromoStatus;
    config: Record<string, any>;
    createdByUserId?: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface GlobalPromoEntry {
    id: string;
    eventId: string;
    serviceId: number;
    liveSessionId?: string | null;
    submittedByUserId?: number | null;
    discountPercentage?: number | null;
    promoPriceCfa?: number | null;
    stockCap?: number | null;
    availability: 'online' | 'live' | 'both';
    status: GlobalPromoStatus;
    metadata: Record<string, any>;
    publishedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    product?: any;
}

export interface GlobalPromoProductSnapshot {
    id: string;
    promoEntryId: string;
    availability: 'online' | 'live' | 'both';
    snapshot: {
        service_id?: number;
        title?: string;
        price?: string | number | null;
        images?: string[] | { url: string }[];
        [key: string]: any;
    };
    priorityScore: number;
    highlighted: boolean;
}

export interface GlobalPromoCatalogItem {
    event: GlobalPromoEvent;
    entry: GlobalPromoEntry;
    product?: GlobalPromoProductSnapshot;
}

export interface SubmitGlobalPromoEntryPayload {
    serviceId: number;
    promoPriceCfa?: number;
    discountPercentage?: number;
    stockCap?: number;
    availability?: 'online' | 'live' | 'both';
    metadata?: Record<string, any>;
}

export interface CreateGlobalPromoEventPayload {
    slug: string;
    theme: string;
    displayName: string;
    description?: string;
    startsAt: string;
    endsAt: string;
    recurrenceRule?: string;
    config?: Record<string, any>;
}

export interface UpsertGlobalPromoEntryPayload {
    serviceId: number;
    liveSessionId?: string;
    discountPercentage?: number;
    promoPriceCfa?: number;
    stockCap?: number;
    availability?: 'online' | 'live' | 'both';
    status?: GlobalPromoStatus;
    metadata?: Record<string, any>;
    highlighted?: boolean;
    priorityScore?: number;
    snapshot?: Record<string, any>;
}

export interface ReviewGlobalPromoEntryPayload {
    status: 'approved' | 'rejected';
    message?: string;
    highlighted?: boolean;
    priorityScore?: number;
    metadataPatch?: Record<string, any>;
}

export interface BulkReviewGlobalPromoEntryPayload {
    entryIds: string[];
    status: 'approved' | 'rejected';
    message?: string;
    highlighted?: boolean;
    priorityScore?: number;
    metadataPatch?: Record<string, any>;
}


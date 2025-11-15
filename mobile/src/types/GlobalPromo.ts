export interface GlobalPromoEvent {
    id: string;
    slug: string;
    theme: string;
    displayName: string;
    description?: string | null;
    startsAt: string;
    endsAt: string;
    status: string;
    config?: Record<string, any>;
}

export interface GlobalPromoEntry {
    id: string;
    eventId: string;
    serviceId: number;
    discountPercentage?: number | null;
    promoPriceCfa?: number | null;
    availability: 'online' | 'live' | 'both';
    status: string;
    metadata?: Record<string, any>;
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


export type DeliveryKind = 'parcel' | 'shopping';

export type DeliveryStatus =
    | 'pending'
    | 'awaiting_courier'
    | 'assigned'
    | 'en_route_pickup'
    | 'shopping_pending'
    | 'shopping_in_progress'
    | 'shopping_completed'
    | 'en_route_delivery'
    | 'delivered'
    | 'cancelled'
    | 'refunded';

export interface DeliveryLocation {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    source?: 'client' | 'courier' | 'recipient' | 'system';
    timestamp?: string;
}

export interface DeliveryParticipant {
    id?: string;
    name?: string;
    phone?: string;
    avatarUrl?: string;
    rating?: number;
}

export interface DeliveryRecipient extends DeliveryParticipant {
    allowTracking?: boolean;
    allowContact?: boolean;
    consentGranted?: boolean;
    countryCode?: string;
    preferredLanguage?: string;
    currentLocation?: DeliveryLocation | null;
    instructions?: string | null;
}

export interface DeliveryCourier extends DeliveryParticipant {
    vehicleType?: string | null;
    etaMinutes?: number | null;
    isOnline?: boolean;
}

export interface DeliveryPricingBreakdown {
    currency: string;
    estimatedTotal?: number | null;
    finalTotal?: number | null;
    distanceFee?: number | null;
    baseFee?: number | null;
    shoppingAdvance?: number | null;
    serviceFee?: number | null;
    tax?: number | null;
    tips?: number | null;
}

export interface DeliveryCheckpoint {
    status: DeliveryStatus;
    timestamp: string;
    note?: string | null;
    actor?: 'system' | 'client' | 'courier' | 'recipient';
    location?: DeliveryLocation | null;
}

export interface ShoppingBasketItem {
    id: string;
    productName: string;
    quantity: number;
    unit?: string;
    estimatedPriceCents?: number | null;
    actualPriceCents?: number | null;
    status?: string;
    note?: string | null;
}

export interface ShoppingSummary {
    items: ShoppingBasketItem[];
    estimatedTotalCents?: number | null;
    finalTotalCents?: number | null;
    currency: string;
    comment?: string | null;
}

export interface DeliverySummary {
    id: string;
    orderId?: string;
    kind: DeliveryKind;
    status: DeliveryStatus;
    clientId?: string;
    courier?: DeliveryCourier | null;
    recipient?: DeliveryRecipient | null;
    pickup: {
        label?: string | null;
        address?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        instructions?: string | null;
    };
    dropoff: {
        label?: string | null;
        address?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        instructions?: string | null;
    };
    checkpoints: DeliveryCheckpoint[];
    pricing?: DeliveryPricingBreakdown | null;
    shopping?: ShoppingSummary | null;
    metadata?: Record<string, unknown>;
    lastEventAt?: string | null;
}

export type DeliveryRealtimeEventType =
    | 'delivery_status'
    | 'delivery_location'
    | 'delivery_pricing'
    | 'shopping_update'
    | 'recipient_dropoff'
    | 'wallet_update'
    | 'delivery_error';

export interface DeliveryRealtimeEvent<TPayload = any> {
    type: DeliveryRealtimeEventType;
    deliveryId: string;
    timestamp: string;
    payload: TPayload;
}

export interface DeliveryLocationUpdatePayload {
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number | null;
    speed?: number | null;
    source?: 'client' | 'courier' | 'recipient';
}

export interface DeliveryRecipientPayload {
    name: string;
    phone: string;
    countryCode?: string;
    consentGranted: boolean;
    instructions?: string;
    allowTracking?: boolean;
}



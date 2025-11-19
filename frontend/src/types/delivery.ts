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

// ✅ Phase 9 - Amélioration : Raisons de refus de colis
export type ParcelRejectionReason =
    | 'damaged'
    | 'wrong_item'
    | 'expired'
    | 'wrong_quantity'
    | 'wrong_size'
    | 'wrong_color'
    | 'quality_issue'
    | 'not_ordered'
    | 'duplicate'
    | 'other';

export interface ShoppingBasketItem {
    id: string;
    productName: string;
    quantity: number;
    unit?: string;
    estimatedPriceCents?: number | null;
    actualPriceCents?: number | null;
    status?: string;
    rejection_reason?: ParcelRejectionReason | null; // ✅ Phase 9 - Amélioration
    note?: string | null;
}

export interface ShoppingSummary {
    items: ShoppingBasketItem[];
    estimatedTotalCents?: number | null;
    finalTotalCents?: number | null;
    currency: string;
    comment?: string | null;
}

// ✅ Phase 9 - Amélioration : Média de preuve de livraison
export interface DeliveryProofMedia {
    id: number;
    delivery_id: string;
    media_type: 'image' | 'video';
    media_url: string;
    proof_type: 'pickup' | 'delivery';
    uploaded_by: number;
    uploaded_at: string;
    metadata?: Record<string, unknown>;
    created_at: string;
}

export interface DeliverySummary {
    id: string;
    orderId?: string;
    kind: DeliveryKind;
    status: DeliveryStatus;
    creator_id?: number; // ✅ Phase 9 - Amélioration 28
    clientId?: string;
    courier?: DeliveryCourier | null;
    recipient?: DeliveryRecipient | null;
    proof_media?: DeliveryProofMedia[]; // ✅ Phase 9 - Amélioration : Médias de preuve
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
    | 'delivery_error'
    | 'dropoff_address_provided'; // ✅ Phase 9 - Amélioration 29

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
    address?: string | null; // ✅ Phase 9 - Amélioration 30 : Adresse optionnelle
}

export interface DeliveryRecipientPayload {
    name: string;
    phone: string;
    countryCode?: string;
    consentGranted: boolean;
    instructions?: string;
    allowTracking?: boolean;
}



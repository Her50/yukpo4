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
    lat: number;
    lng: number;
    accuracy?: number;
    heading?: number | null;
    speed?: number | null;
    updatedAt: string;
    source: 'client' | 'courier' | 'recipient' | 'system';
}

export interface DeliveryParticipant {
    id?: string;
    name?: string;
    phone?: string;
    avatarUrl?: string;
    rating?: number;
    notes?: string;
}

export interface DeliveryRecipient extends DeliveryParticipant {
    trackingToken?: string;
    consentGranted?: boolean;
    canShareLocation?: boolean;
    currentLocation?: DeliveryLocation | null;
    instructions?: string;
}

export interface DeliveryCourier extends DeliveryParticipant {
    vehicleType?: string;
    etaMinutes?: number | null;
    isOnline?: boolean;
}

export interface DeliveryPricingBreakdown {
    estimated: number | null;
    currency: string;
    baseFee?: number | null;
    distanceFee?: number | null;
    shoppingAdvance?: number | null;
    serviceFee?: number | null;
    tax?: number | null;
    tips?: number | null;
    finalTotal?: number | null;
    refundTotal?: number | null;
}

export interface DeliveryCheckpoint {
    status: DeliveryStatus;
    timestamp: string;
    note?: string;
    actor?: 'system' | 'client' | 'courier' | 'recipient';
    location?: DeliveryLocation;
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
    label: string;
    quantity: number;
    unit?: string;
    estimatedPrice?: number | null;
    estimatedTotal?: number | null;
    actualPrice?: number | null;
    actualTotal?: number | null;
    status?: string;
    rejection_reason?: ParcelRejectionReason | null; // ✅ Phase 9 - Amélioration
    note?: string;
    isSubstitution?: boolean;
    imageUrl?: string;
}

export interface ShoppingEstimate {
    subtotal: number;
    deliveryFee: number;
    advance: number;
    total: number;
    currency: string;
    etaMinutes: number;
    recommendation?: string;
}

export interface ShoppingBudgetCheck {
    balance: number;
    missingAmount: number;
    currency: string;
    canProceed: boolean;
}

export interface ShoppingSummary {
    items: ShoppingBasketItem[];
    estimate: ShoppingEstimate | null;
    budgetCheck: ShoppingBudgetCheck | null;
    comment?: string;
}

export interface DeliverySummary {
    id: string;
    orderId?: string;
    kind: DeliveryKind;
    status: DeliveryStatus;
    creator_id?: number; // ✅ Phase 9 - Amélioration 28
    etaIso?: string | null;
    checkpoints: DeliveryCheckpoint[];
    pricing: DeliveryPricingBreakdown | null;
    pickup: {
        label?: string;
        address?: string;
        location?: {
            lat: number;
            lng: number;
        } | null;
        instructions?: string;
    };
    dropoff: {
        label?: string;
        address?: string;
        location?: {
            lat: number;
            lng: number;
        } | null;
        instructions?: string;
    };
    clientId?: string;
    courier?: DeliveryCourier | null;
    recipient?: DeliveryRecipient | null;
    shopping?: ShoppingSummary | null;
    metadata?: Record<string, any>;
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
    source: 'client' | 'courier' | 'recipient';
}

export interface DeliveryRecipientPayload {
    name: string;
    phone: string;
    countryCode?: string;
    consentGranted: boolean;
    instructions?: string;
    deliveryAccess?: string;
    allowTracking?: boolean;
}

export interface ShoppingOrderPayload {
    items: Array<{
        label: string;
        quantity: number;
        unit?: string;
        note?: string;
        estimatedPrice?: number;
    }>;
    pickup: {
        label?: string;
        latitude?: number;
        longitude?: number;
        address?: string;
    };
    dropoff: {
        label?: string;
        latitude?: number;
        longitude?: number;
        address?: string;
    };
    budget: number;
    currency: string;
    comment?: string;
    recipient?: DeliveryRecipientPayload;
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
    metadata?: Record<string, any> | null;
    created_at: string;
}



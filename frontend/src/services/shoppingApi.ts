import { apiGet, apiPost } from './apiService';

export interface ShoppingItemRequest {
    product_id?: string;
    product_name: string;
    characteristics?: unknown;
    quantity: number;
    unit: string;
    estimated_price_cents?: number;
}

export interface ShoppingEstimateRequest {
    items: ShoppingItemRequest[];
    currency?: string;
}

export interface ShoppingEstimateItem {
    product_name: string;
    quantity: number;
    unit: string;
    estimated_price_cents: number;
}

export interface ShoppingEstimateResponse {
    estimate: {
        items: ShoppingEstimateItem[];
        estimated_total_cents: number;
        estimated_shopping_time_minutes: number;
        currency: string;
    };
}

export interface ShoppingStorePayload {
    name?: string;
    latitude: number;
    longitude: number;
    address?: string;
}

export interface ShoppingRecipientPayload {
    user_id?: number;
    contact_name?: string;
    contact_phone?: string;
    notes?: string;
    chat_thread_id?: string;
    dropoff_override?: {
        latitude: number;
        longitude: number;
        address?: string | null;
    };
    dropoff_address?: string | null;
}

export interface ShoppingOrderRequest {
    items: ShoppingItemRequest[];
    store: ShoppingStorePayload;
    dropoff: {
        latitude: number;
        longitude: number;
        address?: string | null;
    };
    recipient?: ShoppingRecipientPayload;
    notes?: string | null;
    currency?: string;
    metadata?: unknown;
    estimated_total_cents: number;
    delivery_base_price_cents: number;
    delivery_distance_price_cents: number;
    delivery_surcharge_cents: number;
    delivery_discount_cents: number;
    delivery_details?: unknown;
    distance_meters?: number | null;
    estimated_duration_seconds?: number | null;
}

export interface ShoppingOrderResponse {
    delivery: unknown;
    shopping_order: unknown;
    items: unknown[];
    estimated_total_cents: number;
    margin_cents: number;
    balance_remaining: number;
}

export interface ShoppingItemUpdateRequest {
    status: string;
    actual_price_cents?: number;
    rejection_reason?: string; // ✅ Phase 9 - Amélioration : Raison de refus
    metadata?: unknown;
}

export interface ShoppingStatusUpdateRequest {
    status: string;
}

export interface ShoppingCheckoutRequest {
    actual_total_cents: number;
    payload?: unknown;
}

export interface WalletBalanceResponse {
    balance: number;
}

export const estimateShoppingOrder = async (
    payload: ShoppingEstimateRequest,
): Promise<ShoppingEstimateResponse> => {
    const response = await apiPost('/shopping/orders/estimate', payload);
    return response.json();
};

export const createShoppingOrder = async (
    payload: ShoppingOrderRequest,
): Promise<ShoppingOrderResponse> => {
    const response = await apiPost('/shopping/orders', payload);
    return response.json();
};

export const updateShoppingItem = async (
    orderId: string,
    itemId: string,
    payload: ShoppingItemUpdateRequest,
): Promise<void> => {
    await apiPost(`/shopping/orders/${orderId}/items/${itemId}`, payload);
};

export const updateShoppingStatus = async (
    orderId: string,
    payload: ShoppingStatusUpdateRequest,
): Promise<void> => {
    await apiPost(`/shopping/orders/${orderId}/status`, payload);
};

export const submitShoppingCheckout = async (
    orderId: string,
    payload: ShoppingCheckoutRequest,
) => {
    const response = await apiPost(`/shopping/orders/${orderId}/checkout`, payload);
    return response.json();
};

export const fetchWalletBalance = async (): Promise<WalletBalanceResponse> => {
    const response = await apiGet('/shopping/wallet/balance');
    return response.json();
};


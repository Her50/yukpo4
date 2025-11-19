import {
    DeliveryLocationUpdatePayload,
    DeliveryRecipientPayload,
    DeliverySummary,
} from '@/types/delivery';
import { apiDelete, apiGet, apiPost, apiPut } from './apiService';

interface ActiveDeliveriesResponse {
    deliveries: DeliverySummary[];
}

export const listActiveDeliveries = async (): Promise<DeliverySummary[]> => {
    const response = await apiGet('/deliveries/active');
    const data: ActiveDeliveriesResponse | DeliverySummary[] = await response.json();
    if (Array.isArray(data)) {
        return data;
    }
    return data.deliveries ?? [];
};

export const getDeliveryById = async (deliveryId: string): Promise<DeliverySummary> => {
    const response = await apiGet(`/deliveries/${deliveryId}`);
    return response.json();
};

export const getDeliveryRecipientUpdates = async (deliveryId: string) => {
    const response = await apiGet(`/deliveries/${deliveryId}/recipient/updates`);
    return response.json();
};

export const assignDeliveryRecipient = async (
    deliveryId: string,
    payload: DeliveryRecipientPayload,
) => {
    const response = await apiPost(`/deliveries/${deliveryId}/recipient`, payload);
    return response.json();
};

export const updateRecipientLocation = async (
    deliveryId: string,
    payload: DeliveryLocationUpdatePayload,
) => {
    // Le backend attend seulement latitude, longitude, et address optionnel
    const backendPayload = {
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address || null,
    };
    const response = await apiPost(`/delivery/${deliveryId}/recipient/location`, backendPayload);
    return response.json();
};

export const updateDeliveryStatus = async (
    deliveryId: string,
    status: string,
    metadata?: Record<string, unknown>,
) => {
    const response = await apiPost(`/deliveries/${deliveryId}/status`, {
        status,
        metadata,
    });
    return response.json();
};

export const cancelDelivery = async (deliveryId: string, reason?: string) => {
    const response = await apiPost(`/deliveries/${deliveryId}/cancel`, { reason });
    return response.json();
};

export const rateDelivery = async (
    deliveryId: string,
    rating: number,
    feedback?: string,
) => {
    const response = await apiPost(`/deliveries/${deliveryId}/rating`, { rating, feedback });
    return response.json();
};

export const debitWalletForDelivery = async (
    deliveryId: string,
    amount: number,
    currency: string,
) => {
    const response = await apiPost(`/wallet/debit`, {
        delivery_id: deliveryId,
        amount,
        currency,
    });
    return response.json();
};

export const refundDelivery = async (
    deliveryId: string,
    amount: number,
    currency: string,
    reason?: string,
) => {
    const response = await apiPost(`/wallet/refund`, {
        delivery_id: deliveryId,
        amount,
        currency,
        reason,
    });
    return response.json();
};

export const deleteDelivery = async (deliveryId: string) => {
    await apiDelete(`/deliveries/${deliveryId}`);
};

// ✅ Phase 9 - Amélioration 28 : Assigner un coursier manuellement
export interface AssignCourierPayload {
    courier_id: string;
}

export const assignCourier = async (
    deliveryId: string,
    payload: AssignCourierPayload,
) => {
    const response = await apiPost(`/delivery/${deliveryId}/assign-courier`, payload);
    return response.json();
};

// ✅ Phase 9 - Amélioration 28 : Lister les coursiers disponibles
export interface AvailableCourier {
    id: string;
    user_id: number;
    name: string | null;
    email: string;
    avatar_url: string | null;
    rating_average: number | null;
    rating_count: number;
    bio: string | null;
    stats: {
        completed_deliveries: number;
        cancelled_deliveries: number;
        avg_delivery_time_minutes: number | null;
        success_rate: number;
    };
}

export interface AvailableCouriersResponse {
    couriers: AvailableCourier[];
    total: number;
}

export const listAvailableCouriers = async (
    serviceId?: number,
): Promise<AvailableCouriersResponse> => {
    const params = serviceId ? `?service_id=${serviceId}` : '';
    const response = await apiGet(`/couriers/available${params}`);
    return response.json();
};

// ✅ Phase 9 - Amélioration 32 : Gestion des lieux de stock
export interface MerchantStorageLocation {
    id: number;
    merchant_user_id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    zone_id?: string | null; // ✅ Phase 9 - Amélioration : Zone géographique associée
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface MerchantStorageLocationInput {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    zone_id?: string | null; // ✅ Phase 9 - Amélioration : Zone géographique associée
    is_active?: boolean;
}

export interface StorageLocationsResponse {
    locations: MerchantStorageLocation[];
    total: number;
}

export const listStorageLocations = async (): Promise<StorageLocationsResponse> => {
    const response = await apiGet('/delivery/storage-locations');
    return response.json();
};

export const getStorageLocation = async (id: number): Promise<MerchantStorageLocation> => {
    const response = await apiGet(`/delivery/storage-locations/${id}`);
    return response.json();
};

export const createStorageLocation = async (
    payload: MerchantStorageLocationInput,
): Promise<MerchantStorageLocation> => {
    const response = await apiPost('/delivery/storage-locations', payload);
    return response.json();
};

export const updateStorageLocation = async (
    id: number,
    payload: MerchantStorageLocationInput,
): Promise<MerchantStorageLocation> => {
    const response = await apiPut(`/delivery/storage-locations/${id}`, payload);
    return response.json();
};

export const deleteStorageLocation = async (id: number): Promise<void> => {
    await apiDelete(`/delivery/storage-locations/${id}`);
};

// ✅ Phase 9 - Amélioration : Lister les zones de livraison disponibles
export interface DeliveryZone {
    id: string;
    name: string;
    description?: string | null;
    is_active: boolean;
}

export const listDeliveryZones = async (): Promise<DeliveryZone[]> => {
    const response = await apiGet('/delivery/zones');
    const data = await response.json();
    return Array.isArray(data) ? data : data.zones || [];
};

// ✅ Phase 9 - Amélioration : Rejeter un produit avec raison
export interface RejectShoppingItemPayload {
    status: 'rejected';
    rejection_reason: string;
}

export const rejectShoppingItem = async (
    orderId: string,
    itemId: string,
    reason: string,
): Promise<void> => {
    const response = await apiPost(`/shopping/orders/${orderId}/items/${itemId}`, {
        status: 'rejected',
        rejection_reason: reason,
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Impossible de refuser le produit');
    }
};

// ✅ Phase 9 - Amélioration : Gestion des médias de preuve de livraison
export interface DeliveryProofMediaInput {
    media_type: 'image' | 'video';
    media_url: string;
    proof_type: 'pickup' | 'delivery';
    metadata?: Record<string, unknown>;
}

export interface ProofMediaResponse {
    media: DeliveryProofMedia[];
    total: number;
}

export const listProofMedia = async (deliveryId: string): Promise<ProofMediaResponse> => {
    const response = await apiGet(`/delivery/${deliveryId}/proof-media`);
    return response.json();
};

export const uploadProofMedia = async (
    deliveryId: string,
    payload: DeliveryProofMediaInput,
): Promise<DeliveryProofMedia> => {
    const response = await apiPost(`/delivery/${deliveryId}/proof-media`, payload);
    return response.json();
};

export const deleteProofMedia = async (deliveryId: string, mediaId: number): Promise<void> => {
    await apiDelete(`/delivery/${deliveryId}/proof-media/${mediaId}`);
};



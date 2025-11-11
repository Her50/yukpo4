import {
    DeliveryLocationUpdatePayload,
    DeliveryRecipientPayload,
    DeliverySummary,
} from '@/types/delivery';
import { apiDelete, apiGet, apiPost } from './apiService';

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
    const response = await apiPost(`/deliveries/${deliveryId}/recipient/location`, payload);
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



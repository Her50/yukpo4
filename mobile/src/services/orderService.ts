/**
 * Service pour gérer les commandes produits
 * Gère la création, validation, rejet et récupération de produits similaires
 */

import { API_BASE_URL } from '../config/api';
import { getToken } from '../lib/yukpoaclient';

export interface CreateOrderPayload {
    delivery_id?: string;
    service_id: number;
    product_index: number;
    client_user_id: number;
    provider_user_id: number;
    validation_timeout_minutes?: number;
}

export interface ValidateOrderPayload {
    estimated_ready_at?: Date; // Optionnel si is_immediately_available = true
}

export interface RejectOrderPayload {
    reason: string;
}

export interface Order {
    id: string;
    delivery_id?: string;
    service_id: number;
    product_index: number;
    client_user_id: number;
    provider_user_id: number;
    status: 'pending' | 'validated' | 'ready' | 'rejected' | 'cancelled';
    preparation_time_minutes?: number;
    estimated_ready_at?: string;
    validated_at?: string;
    validated_by?: number;
    rejected_at?: string;
    rejection_reason?: string;
    validation_deadline?: string;
    created_at: string;
    updated_at: string;
    metadata?: any;
}

export interface SimilarProduct {
    service_id: number;
    product_index: number;
    product_id: string;
    product_name?: string;
    product_description?: string;
    category?: string;
    price?: string;
    pickup_address?: string;
    is_immediately_available?: boolean;
    preparation_time_minutes?: number;
    availability_days?: number[];
    similarity_score: number;
}

export interface PickupLocation {
    address: string;
    id: number;
}

export const orderService = {
    /**
     * Créer une commande avec vérification disponibilité
     * IMPORTANT: Les lieux pickup retournés doivent être en adresse textuelle
     */
    createOrder: async (orderData: CreateOrderPayload): Promise<{ success: boolean; order?: Order; available?: boolean; reason?: string; similar_products?: SimilarProduct[]; message?: string }> => {
        const token = await getToken();
        if (!token) {
            throw new Error('Token d\'authentification manquant');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/delivery/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(orderData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la création de la commande');
            }

            return data;
        } catch (error: any) {
            console.error('[orderService] Erreur création commande:', error);
            throw error;
        }
    },

    /**
     * Prestataire valide commande
     * Si is_immediately_available = true, estimatedReadyAt peut être null
     */
    validateOrder: async (orderId: string, payload: ValidateOrderPayload): Promise<Order> => {
        const token = await getToken();
        if (!token) {
            throw new Error('Token d\'authentification manquant');
        }

        try {
            const requestBody: any = {};
            if (payload.estimated_ready_at) {
                requestBody.estimated_ready_at = payload.estimated_ready_at.toISOString();
            }

            const response = await fetch(`${API_BASE_URL}/api/delivery/orders/${orderId}/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la validation de la commande');
            }

            return data.order;
        } catch (error: any) {
            console.error('[orderService] Erreur validation commande:', error);
            throw error;
        }
    },

    /**
     * Prestataire invalide commande
     */
    rejectOrder: async (orderId: string, reason: string): Promise<Order> => {
        const token = await getToken();
        if (!token) {
            throw new Error('Token d\'authentification manquant');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/delivery/orders/${orderId}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ reason }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors du rejet de la commande');
            }

            return data.order;
        } catch (error: any) {
            console.error('[orderService] Erreur rejet commande:', error);
            throw error;
        }
    },

    /**
     * Récupérer produits similaires
     */
    getSimilarProducts: async (orderId: string): Promise<SimilarProduct[]> => {
        const token = await getToken();
        if (!token) {
            throw new Error('Token d\'authentification manquant');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/delivery/orders/${orderId}/similar`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la récupération des produits similaires');
            }

            return data.similar_products || [];
        } catch (error: any) {
            console.error('[orderService] Erreur récupération produits similaires:', error);
            throw error;
        }
    },

    /**
     * Récupérer une commande
     */
    getOrder: async (orderId: string): Promise<Order> => {
        const token = await getToken();
        if (!token) {
            throw new Error('Token d\'authentification manquant');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/delivery/orders/${orderId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la récupération de la commande');
            }

            return data.order;
        } catch (error: any) {
            console.error('[orderService] Erreur récupération commande:', error);
            throw error;
        }
    },

    /**
     * Récupérer les commandes en attente pour le prestataire
     */
    getProviderPendingOrders: async (): Promise<Order[]> => {
        const token = await getToken();
        if (!token) {
            throw new Error('Token d\'authentification manquant');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/delivery/orders/provider/pending`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la récupération des commandes');
            }

            return data.orders || [];
        } catch (error: any) {
            console.error('[orderService] Erreur récupération commandes prestataire:', error);
            throw error;
        }
    },

    /**
     * Récupérer les commandes du client
     */
    getClientOrders: async (): Promise<Order[]> => {
        const token = await getToken();
        if (!token) {
            throw new Error('Token d\'authentification manquant');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/delivery/orders/client/my-orders`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la récupération des commandes');
            }

            return data.orders || [];
        } catch (error: any) {
            console.error('[orderService] Erreur récupération commandes client:', error);
            throw error;
        }
    },

    /**
     * Récupérer lieux pickup (retourne adresses textuelles, pas GPS)
     */
    getPickupLocations: async (configId: number): Promise<PickupLocation[]> => {
        const token = await getToken();
        if (!token) {
            throw new Error('Token d\'authentification manquant');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/delivery/config/${configId}/pickup-locations`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la récupération des lieux pickup');
            }

            return data.pickup_locations || [];
        } catch (error: any) {
            console.error('[orderService] Erreur récupération lieux pickup:', error);
            throw error;
        }
    },
};


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

// ✅ Nouveau : Créer une demande de livraison (parcel ou shopping)
export interface CreateDeliveryRequestPayload {
    parcel: {
        type_id?: number;
        weight_kg?: number;
        volume_cm3?: number;
        declared_value?: number;
        notes?: string;
        photos?: string[] | Record<string, unknown> | unknown[];
        constraints?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
    };
    pickup: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    dropoff: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    distance_meters?: number;
    estimated_duration_seconds?: number;
    metadata?: Record<string, unknown>;
    initial_event_payload?: Record<string, unknown>;
    recipient?: DeliveryRecipientPayload;
}

export interface CreateDeliveryRequestResponse {
    id: string;
    status: string;
    kind: 'parcel' | 'shopping';
}

export const createDeliveryRequest = async (
    payload: CreateDeliveryRequestPayload,
): Promise<CreateDeliveryRequestResponse> => {
    // ✅ CORRIGÉ : Utiliser l'endpoint existant /api/delivery au lieu de /api/delivery/request
    // ✅ CORRIGÉ : Normaliser le payload pour correspondre au format backend
    const normalizedPayload = {
        ...payload,
        parcel: {
            ...payload.parcel,
            // S'assurer que photos est toujours un tableau (pas undefined)
            photos: payload.parcel.photos || [],
            // S'assurer que constraints est toujours un objet (pas undefined)
            constraints: payload.parcel.constraints || {},
        },
        // S'assurer que metadata est toujours un objet
        metadata: payload.metadata || {},
        // S'assurer que initial_event_payload est toujours un objet
        initial_event_payload: payload.initial_event_payload || {},
    };

    const response = await apiPost('/api/delivery', normalizedPayload);
    const data = await response.json();

    // ✅ CORRIGÉ : Extraire les données de la réponse backend
    // Le backend retourne { "delivery": DeliverySummary }
    const delivery = data.delivery || data;
    const kind = delivery.metadata?.kind || (delivery.shopping_required ? 'shopping' : 'parcel');

    return {
        id: delivery.id,
        status: delivery.status,
        kind: kind as 'parcel' | 'shopping',
    };
};

// ✅ Nouveau : Récupérer la liste des supermarchés à proximité
export interface Supermarket {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distance?: number;
    phone?: string;
    website?: string;
}

export interface SupermarketsResponse {
    supermarkets: Supermarket[];
    total: number;
}

// ✅ Cache pour les supermarchés
interface CachedSupermarkets {
    supermarkets: Supermarket[];
    timestamp: number;
    latitude: number;
    longitude: number;
    radiusKm: number;
}

const SUPERMARKETS_CACHE_KEY = 'yukpo_supermarkets_cache';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (lat: number, lng: number, radius: number): string => {
    // Arrondir les coordonnées pour regrouper les requêtes proches
    const roundedLat = Math.round(lat * 100) / 100; // 2 décimales
    const roundedLng = Math.round(lng * 100) / 100;
    return `${SUPERMARKETS_CACHE_KEY}_${roundedLat}_${roundedLng}_${radius}`;
};

const getCachedSupermarkets = (lat: number, lng: number, radiusKm: number): Supermarket[] | null => {
    try {
        const cacheKey = getCacheKey(lat, lng, radiusKm);
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return null;

        const data: CachedSupermarkets = JSON.parse(cached);
        const now = Date.now();

        // Vérifier si le cache est encore valide
        if (now - data.timestamp > CACHE_DURATION_MS) {
            localStorage.removeItem(cacheKey);
            return null;
        }

        // Vérifier si la position est proche (dans un rayon de 1km)
        const distance = Math.sqrt(
            Math.pow(data.latitude - lat, 2) + Math.pow(data.longitude - lng, 2)
        ) * 111; // Approximation en km
        if (distance > 1) {
            return null; // Position trop éloignée
        }

        return data.supermarkets;
    } catch (error) {
        console.warn('Erreur lecture cache supermarchés:', error);
        return null;
    }
};

const setCachedSupermarkets = (lat: number, lng: number, radiusKm: number, supermarkets: Supermarket[]): void => {
    try {
        const cacheKey = getCacheKey(lat, lng, radiusKm);
        const data: CachedSupermarkets = {
            supermarkets,
            timestamp: Date.now(),
            latitude: lat,
            longitude: lng,
            radiusKm,
        };
        localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
        console.warn('Erreur écriture cache supermarchés:', error);
    }
};

export const listSupermarkets = async (
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
): Promise<SupermarketsResponse> => {
    try {
        // ✅ Vérifier le cache d'abord
        const cached = getCachedSupermarkets(latitude, longitude, radiusKm);
        if (cached) {
            console.log('[DeliveryApi] ✅ Supermarchés récupérés depuis le cache');
            return {
                supermarkets: cached,
                total: cached.length,
            };
        }

        // Utiliser l'API nearby services avec filtre pour les supermarchés
        const response = await apiGet(
            `/api/services/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radiusKm * 1000}&limit=20`
        );
        const data = await response.json();

        // Filtrer les services qui sont des supermarchés
        const supermarkets: Supermarket[] = (data.services || [])
            .filter((service: any) => {
                const category = (service.category || '').toLowerCase();
                const name = (service.name || '').toLowerCase();
                const description = (service.description || '').toLowerCase();

                // Mots-clés pour identifier les supermarchés
                const keywords = ['supermarche', 'supermarket', 'carrefour', 'casino', 'super u', 'auchan', 'leclerc', 'intermarche', 'monoprix', 'franprix', 'magasin', 'epicerie', 'hypermarché', 'hypermarché'];

                return keywords.some(keyword =>
                    category.includes(keyword) ||
                    name.includes(keyword) ||
                    description.includes(keyword)
                );
            })
            .map((service: any) => ({
                id: service.id,
                name: service.name,
                address: service.address || 'Adresse non disponible',
                latitude: service.latitude || 0,
                longitude: service.longitude || 0,
                distance: service.distance ? Math.round(service.distance / 1000 * 10) / 10 : undefined, // Convertir en km
                phone: service.phone,
                website: service.website,
            }));

        // ✅ Mettre en cache les résultats
        setCachedSupermarkets(latitude, longitude, radiusKm, supermarkets);

        return {
            supermarkets,
            total: supermarkets.length,
        };
    } catch (error) {
        console.error('Erreur récupération supermarchés:', error);
        // Retourner une liste vide en cas d'erreur
        return { supermarkets: [], total: 0 };
    }
};



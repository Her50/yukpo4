// ✅ Service API pour Taxi avec toutes les fonctionnalités backend
import { apiGet, apiPost } from './api';

// Types pour les taxis
export interface Taxi {
    id: number;
    service_id: number;
    user_id: number;
    nom_chauffeur?: string;
    telephone: string;
    whatsapp?: string;
    type_vehicule?: string;
    marque_modele?: string;
    immatriculation?: string;
    couleur?: string;
    annee?: number;
    zone_intervention?: string[];
    gps_actuel?: string;
    tarif_base?: number;
    tarif_par_km?: number;
    devise: string;
    paiement_cash: boolean;
    paiement_mobile_money: boolean;
    paiement_carte: boolean;
    climatisation: boolean;
    wifi: boolean;
    is_available: boolean;
    created_at?: string;
    updated_at?: string;
    distance_km?: number;
    rating?: number;
}

export interface SearchTaxisFilters {
    ville?: string;
    quartier?: string;
    lat?: number;
    lng?: number;
    radius_km?: number;
    page?: number;
    limit?: number;
}

export interface CreateTaxiRequest {
    service_id: number;
    nom_chauffeur?: string;
    telephone: string;
    whatsapp?: string;
    type_vehicule?: string;
    marque_modele?: string;
    immatriculation?: string;
    couleur?: string;
    annee?: number;
    zone_intervention?: string[];
    gps_actuel?: string;
    tarif_base?: number;
    tarif_par_km?: number;
    devise?: string;
    paiement_cash?: boolean;
    paiement_mobile_money?: boolean;
    paiement_carte?: boolean;
    climatisation?: boolean;
    wifi?: boolean;
}

export interface RouteOptimization {
    route: Array<{ lat: number; lng: number }>;
    distance_km: number;
    estimated_time_minutes: number;
    optimized_order: number[];
}

export interface DemandPrediction {
    zone: string;
    predicted_demand: number;
    confidence: number;
    time_window: string;
    recommendations: string[];
}

export const taxiService = {
    // ✅ Recherche de taxis
    searchTaxis: async (filters: SearchTaxisFilters) => {
        const response = await apiGet<{ success: boolean; data: Taxi[]; total: number }>(
            '/api/taxis/search',
            { params: filters }
        );
        return response;
    },

    // ✅ Détails d'un taxi
    getTaxiDetails: async (taxiId: number) => {
        const response = await apiGet<{ success: boolean; data: Taxi }>(
            `/api/taxis/${taxiId}`
        );
        return response;
    },

    // ✅ Créer un taxi
    createTaxi: async (taxi: CreateTaxiRequest) => {
        const response = await apiPost<{ success: boolean; id: number; message: string }>(
            '/api/taxis',
            taxi
        );
        return response;
    },

    // ✅ Mes taxis
    getMesTaxis: async () => {
        const response = await apiGet<{ success: boolean; data: Taxi[] }>(
            '/api/taxis'
        );
        return response;
    },

    // ✅ Prédiction de demande IA
    predictDemand: async (zone: string, timeWindow: string) => {
        const response = await apiPost<{ success: boolean; prediction: DemandPrediction }>(
            '/api/taxi/demand-prediction',
            {
                zone,
                time_window: timeWindow,
            }
        );
        return response;
    },

    // ✅ Optimisation de route IA
    optimizeRoute: async (waypoints: Array<{ lat: number; lng: number }>) => {
        const response = await apiPost<{ success: boolean; optimization: RouteOptimization }>(
            '/api/taxi/optimize-route',
            {
                waypoints,
            }
        );
        return response;
    },

    // ✅ Recommandations personnalisées
    getPersonalizedRecommendations: async (userId: number, lat?: number, lng?: number) => {
        const response = await apiGet<{ success: boolean; recommendations: Taxi[] }>(
            '/api/taxi/personalized-recommendations',
            {
                params: {
                    user_id: userId,
                    lat,
                    lng,
                },
            }
        );
        return response;
    },

    // ✅ Prix dynamique IA
    calculateDynamicPrice: async (params: {
        base_price: number;
        distance_km: number;
        zone_id: string;
        latitude: number;
        longitude: number;
        radius_km?: number;
        vehicle_type?: string;
    }) => {
        const response = await apiPost<{
            success: boolean;
            data: {
                base_price: number;
                dynamic_multiplier: number;
                final_price: number;
                surge_factor: number;
                demand_factor: number;
                supply_factor: number;
                time_factor: number;
                confidence: number;
                reasoning: string;
            };
        }>(
            '/api/taxi/dynamic-price',
            {
                base_price: params.base_price,
                distance_km: params.distance_km,
                zone_id: params.zone_id,
                latitude: params.latitude,
                longitude: params.longitude,
                radius_km: params.radius_km || 10,
                vehicle_type: params.vehicle_type || 'taxi',
            }
        );
        return response;
    },

    // ✅ Prédiction demande multi-zones IA
    predictDemandMultiZone: async (zones: Array<{ zone_id: string; latitude: number; longitude: number; radius_km: number }>) => {
        const response = await apiPost<{ success: boolean; data: any }>(
            '/api/taxi/demand-prediction/multi-zone',
            { zones }
        );
        return response;
    },

    // ✅ Heatmap demande IA
    getDemandHeatmap: async (lat: number, lng: number, radiusKm: number = 20) => {
        const response = await apiGet<{ success: boolean; data: any }>(
            '/api/taxi/demand-prediction/heatmap',
            { params: { lat, lng, radius_km: radiusKm } }
        );
        return response;
    },

    // ✅ Analytics overview (chauffeur)
    getAnalyticsOverview: async () => {
        const response = await apiGet<{ success: boolean; data: any }>(
            '/api/admin/taxi/analytics/overview'
        );
        return response;
    },

    // ✅ Tendances demande (chauffeur)
    getDemandTrends: async () => {
        const response = await apiGet<{ success: boolean; data: any }>(
            '/api/admin/taxi/analytics/demand-trends'
        );
        return response;
    },

    // ✅ Analytics revenus (chauffeur)
    getRevenueAnalytics: async () => {
        const response = await apiGet<{ success: boolean; data: any }>(
            '/api/admin/taxi/analytics/revenue'
        );
        return response;
    },

    // ✅ Performance chauffeur
    getDriverPerformance: async () => {
        const response = await apiGet<{ success: boolean; data: any }>(
            '/api/admin/taxi/analytics/driver-performance'
        );
        return response;
    },

    // ✅ Réserver un taxi (passager)
    bookTaxi: async (taxiId: number, data: {
        departure_gps?: string;
        arrival_gps?: string;
        notes?: string;
        insurance_type?: string;
    }) => {
        const response = await apiPost<{ success: boolean; reservation_id: number; message: string }>(
            `/api/taxis/${taxiId}/book`,
            data
        );
        return response;
    },

    // ✅ Mettre à jour la disponibilité (chauffeur)
    updateAvailability: async (taxiId: number, disponible: boolean) => {
        const response = await apiPost<{ success: boolean }>(
            `/api/taxis/${taxiId}/update-availability`,
            { disponible }
        );
        return response;
    },

    // ✅ Mettre à jour la position GPS (chauffeur)
    updateGPS: async (taxiId: number, lat: number, lng: number) => {
        const response = await apiPost<{ success: boolean }>(
            `/api/taxis/${taxiId}/update-gps`,
            { gps_actuel: `${lat},${lng}` }
        );
        return response;
    },

    // ✅ Obtenir la position du chauffeur (passager - pour tracking)
    getDriverLocation: async (taxiId: number) => {
        const response = await apiGet<{ success: boolean; data: { latitude: number; longitude: number; heading?: number; status?: string } }>(
            `/api/taxis/${taxiId}/location`
        );
        return response;
    },
};


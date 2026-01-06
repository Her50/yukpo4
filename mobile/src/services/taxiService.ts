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
    calculateDynamicPrice: async (distanceKm: number, durationMinutes: number, zone: string, timeOfDay: string) => {
        const response = await apiPost<{ success: boolean; price: number; factors: string[] }>(
            '/api/taxi/dynamic-price',
            {
                distance_km: distanceKm,
                duration_minutes: durationMinutes,
                zone,
                time_of_day: timeOfDay,
            }
        );
        return response;
    },
};


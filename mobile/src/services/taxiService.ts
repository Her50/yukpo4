// ✅ Service API pour Taxi avec toutes les fonctionnalités backend
import * as Notifications from 'expo-notifications';
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

export interface Waypoint {
    lat: number;
    lng: number;
    address: string;
    label?: string;
}

export interface TaxiRide {
    id: number;
    taxi_id: number;
    user_id: number;
    departure_gps?: string;
    arrival_gps?: string;
    departure_address?: string;
    arrival_address?: string;
    waypoints?: Waypoint[];
    status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
    scheduled_at?: string;
    fare?: number;
    driver_name?: string;
    vehicle_info?: string;
    duration_minutes?: number;
    notes?: string;
    created_at: string;
    rating?: number;
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

    // === T1 - ESTIMATION TARIFAIRE ===

    estimateFare: async (params: {
        origin: { lat: number; lng: number };
        destination: { lat: number; lng: number };
        taxiId?: number;
    }) => {
        // Calcul distance approximative (Haversine)
        const R = 6371;
        const dLat = (params.destination.lat - params.origin.lat) * Math.PI / 180;
        const dLon = (params.destination.lng - params.origin.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(params.origin.lat * Math.PI / 180) *
            Math.cos(params.destination.lat * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
        const distance_km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const response = await taxiService.calculateDynamicPrice({
            base_price: 500,
            distance_km,
            zone_id: `${params.origin.lat},${params.origin.lng}`,
            latitude: params.origin.lat,
            longitude: params.origin.lng,
            radius_km: 10,
            vehicle_type: 'taxi',
        });
        return response;
    },

    // === T2 - COURSE PLANIFIÉE ===

    scheduleTaxiRide: async (taxiId: number, data: {
        origin: string;
        destination: string;
        scheduled_at: string;
        notes?: string;
    }) => {
        const response = await apiPost<{ success: boolean; reservation_id: number; message: string }>(
            `/api/taxis/${taxiId}/schedule`,
            data
        );
        // Programmer notification locale 30min avant
        if (response.success) {
            const rideDate = new Date(data.scheduled_at);
            const notifDate = new Date(rideDate.getTime() - 30 * 60 * 1000);
            if (notifDate > new Date()) {
                const { status } = await Notifications.requestPermissionsAsync();
                if (status === 'granted') {
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: 'Rappel de course planifiée',
                            body: `Votre taxi part dans 30 minutes : ${data.origin} → ${data.destination}`,
                            data: { type: 'taxi_scheduled_reminder', taxiId },
                        },
                        trigger: {
                            type: Notifications.SchedulableTriggerInputTypes.DATE,
                            date: notifDate,
                        },
                    });
                }
            }
        }
        return response;
    },

    // === T3 - RÉSERVATION AVEC WAYPOINTS (extension bookTaxi) ===

    bookTaxiWithWaypoints: async (taxiId: number, data: {
        departure_gps?: string;
        arrival_gps?: string;
        notes?: string;
        insurance_type?: string;
        waypoints?: Waypoint[];
    }) => {
        const response = await apiPost<{ success: boolean; reservation_id: number; message: string }>(
            `/api/taxis/${taxiId}/book`,
            data
        );
        return response;
    },

    // === T4 - RATING BIDIRECTIONNEL ===

    submitRating: async (rideId: number, rating: number, comment?: string, tags?: string[]) => {
        const response = await apiPost<{ success: boolean; message: string }>(
            `/api/taxis/rides/${rideId}/rating`,
            { rating, comment, tags }
        );
        return response;
    },

    getMyRides: async (page?: number) => {
        const response = await apiGet<{ success: boolean; data: TaxiRide[]; total: number }>(
            '/api/taxis/rides/my-history',
            { params: { page } }
        );
        return response;
    },

    // === T5 - HISTORIQUE COURSES ===

    getMyRidesHistory: async (page?: number, limit?: number) => {
        const response = await apiGet<{ success: boolean; data: TaxiRide[]; total: number }>(
            '/api/taxis/rides/my-history',
            { params: { page, limit } }
        );
        return response;
    },

    // === T6 - SOS SÉCURITÉ ===

    sendSOSAlert: async (rideId: number, lat: number, lng: number) => {
        const response = await apiPost<{ success: boolean; message: string }>(
            `/api/taxis/rides/${rideId}/sos`,
            { latitude: lat, longitude: lng }
        );
        return response;
    },

    // === T7 - SUIVI GPS ===

    getDriverLocationByRide: async (rideId: number) => {
        const response = await apiGet<{ success: boolean; data: { latitude: number; longitude: number; heading?: number; status?: string } }>(
            `/api/taxis/rides/${rideId}/driver-location`
        );
        return response;
    },

    updateMyLocation: async (rideId: number, lat: number, lng: number) => {
        const response = await apiPost<{ success: boolean }>(
            `/api/taxis/rides/${rideId}/driver-location`,
            { latitude: lat, longitude: lng }
        );
        return response;
    },
};


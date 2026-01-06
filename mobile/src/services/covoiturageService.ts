// ✅ Service API pour Covoiturage avec toutes les fonctionnalités backend
import { apiGet, apiPost } from './api';

// Types pour les covoiturages
export interface Covoiturage {
    id: number;
    service_id: number;
    user_id: number;
    depart: string;
    destination: string;
    gps_depart?: string;
    gps_destination?: string;
    date_depart: string;
    heure_depart: string;
    type_vehicule?: string;
    marque_modele?: string;
    nombre_places: number;
    places_disponibles: number;
    prix_par_place: number;
    devise: string;
    bagages_autorises: boolean;
    animaux_autorises: boolean;
    fumeur_autorise: boolean;
    climatisation: boolean;
    created_at?: string;
    updated_at?: string;
    distance_km?: number;
    driver_name?: string;
    driver_rating?: number;
}

export interface SearchCovoituragesFilters {
    depart?: string;
    destination?: string;
    date_depart?: string;
    page?: number;
    limit?: number;
    lat?: number;
    lng?: number;
    radius_km?: number;
}

export interface CreateCovoiturageRequest {
    service_id: number;
    depart: string;
    destination: string;
    gps_depart?: string;
    gps_destination?: string;
    date_depart: string; // ISO 8601
    heure_depart: string; // HH:MM
    type_vehicule?: string;
    marque_modele?: string;
    nombre_places: number;
    places_disponibles: number;
    prix_par_place: number;
    devise?: string;
    bagages_autorises?: boolean;
    animaux_autorises?: boolean;
    fumeur_autorise?: boolean;
    climatisation?: boolean;
}

export const covoiturageService = {
    // ✅ Recherche de covoiturages
    searchCovoiturages: async (filters: SearchCovoituragesFilters) => {
        const response = await apiGet<{ success: boolean; data: Covoiturage[]; total: number }>(
            '/api/covoiturages/search',
            { params: filters }
        );
        return response;
    },

    // ✅ Recherche de covoiturages à proximité
    searchCovoituragesNearby: async (lat: number, lng: number, radiusKm?: number, dateDepart?: string) => {
        const response = await apiGet<{ success: boolean; data: Covoiturage[]; total: number }>(
            '/api/covoiturages/nearby',
            {
                params: {
                    lat,
                    lng,
                    radius_km: radiusKm,
                    date_depart: dateDepart,
                },
            }
        );
        return response;
    },

    // ✅ Détails d'un covoiturage
    getCovoiturageDetails: async (covoiturageId: number) => {
        const response = await apiGet<{ success: boolean; data: Covoiturage }>(
            `/api/covoiturages/${covoiturageId}`
        );
        return response;
    },

    // ✅ Avis d'un covoiturage
    getCovoiturageReviews: async (covoiturageId: number) => {
        const response = await apiGet<{ success: boolean; data: any[]; total: number }>(
            `/api/covoiturages/${covoiturageId}/reviews`
        );
        return response;
    },

    // ✅ Créer un covoiturage
    createCovoiturage: async (covoiturage: CreateCovoiturageRequest) => {
        const response = await apiPost<{ success: boolean; id: number; message: string }>(
            '/api/covoiturages',
            covoiturage
        );
        return response;
    },

    // ✅ Mes covoiturages
    getMesCovoiturages: async () => {
        const response = await apiGet<{ success: boolean; data: Covoiturage[] }>(
            '/api/covoiturages'
        );
        return response;
    },
};


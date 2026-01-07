// ✅ Service API pour Hôpitaux avec fonctionnalités IA
import { apiGet, apiPost } from './api';

// Types pour les prestations médicales
export interface MedicalService {
    id: number;
    name: string;
    category?: string;
    description?: string;
    price?: number;
    duration_minutes?: number;
    hospital_id?: number;
    hospital_name?: string;
    speciality?: string;
}

export interface MedicalServiceAvailability {
    service_id: number;
    service_title: string;
    available_services: string[];
    current_schedule?: { [key: string]: any };
    is_24h: boolean;
    has_blood_bank: boolean;
    distance_km?: number;
}

export interface PathologySearchResult {
    pathology_name: string;
    description: string;
    symptoms: string[];
    recommended_examinations: string[];
    recommended_services: string[];
    urgency_level: 'critical' | 'high' | 'moderate' | 'low';
    recommendations: string[];
    hospitals_suggested?: Array<{
        hospital_id: number;
        hospital_name: string;
        speciality: string;
        distance_km?: number;
    }>;
}

export const hospitalService = {
    // ✅ Autocomplete des prestations médicales
    searchMedicalServices: async (query: string, limit: number = 20) => {
        const response = await apiGet<{ success: boolean; services: MedicalService[] }>(
            '/api/hopitaux/services/autocomplete',
            { params: { query, limit } }
        );
        return response;
    },

    // ✅ Recherche IA de pathologie (pour hôpitaux)
    searchPathology: async (query: string, symptoms?: string[], location?: { lat: number; lng: number }) => {
        const response = await apiPost<{ success: boolean; results: PathologySearchResult[] }>(
            '/api/hopitaux/ai/search-pathology',
            {
                query,
                symptoms,
                lat: location?.lat,
                lng: location?.lng,
            }
        );
        return response;
    },

    // ✅ Recherche de services médicaux disponibles (avec système de disponibilité)
    searchAvailableMedicalServices: async (
        service?: string,
        location?: { lat: number; lng: number },
        maxDistance?: number
    ) => {
        const response = await apiGet<MedicalServiceAvailability[]>(
            '/api/search/medical-services',
            {
                params: {
                    service,
                    lat: location?.lat,
                    lng: location?.lng,
                    max_distance: maxDistance || 50,
                }
            }
        );
        return response;
    },
};

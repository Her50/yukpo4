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

export interface WaitTime {
    department?: string;
    specialty?: string;
    estimated_wait_minutes?: number;
    avg_wait_time_minutes?: number;
    max_wait_time_minutes?: number;
    queue_length?: number;
    consultation_count?: number;
    last_updated?: string;
}

export interface HospitalRecommendation {
    urgency_level?: number;
    recommended_specialty?: string;
    recommended_hospitals?: Array<{
        hospital_id: number;
        hospital_name: string;
        distance_km?: number;
        speciality?: string;
        wait_time_minutes?: number;
    }>;
    preliminary_analysis?: string;
    advice?: string[];
    warning?: string;
    recommendations?: any[];
    specialties?: string[];
    hospital_ids?: number[];
}

// Alias pour compatibilité avec MyConsultationsScreen
export interface HospitalConsultation {
    id: number;
    hospital_id: number;
    hospital_name?: string;
    specialty?: string;
    doctor_name?: string;
    consultation_date?: string;
    status?: string;
    notes?: string;
    created_at?: string;
    type_etablissement?: string;
}

export interface EmergencyStatus {
    is_open?: boolean;
    status?: string;
    current_capacity?: number;
    max_capacity?: number;
    occupancy_rate?: number;
    average_wait_minutes?: number;
    avg_wait_time_minutes?: number;
    critical_count?: number;
    total_patients?: number;
    severity_levels?: {
        critical: number;
        high: number;
        moderate: number;
        low: number;
    };
    last_updated?: string;
}

export const hospitalService = {
    // ✅ Autocomplete des prestations médicales
    searchMedicalServices: async (query: string, limit: number = 20) => {
        const response = await apiGet<{ success: boolean; services: MedicalService[] }>(
            '/api/hopitaux/services/autocomplete',
            { params: { query, limit } }
        );
        const resData = (response?.data || response) as any;
        return { success: response.success, services: resData?.services || [], data: resData };
    },

    // ✅ Recherche IA de pathologie (pour hôpitaux)
    searchPathology: async (query: string, symptoms?: string[], location?: { lat: number; lng: number }) => {
        try {
            const response = await apiPost<{ success: boolean; results?: PathologySearchResult[]; data?: PathologySearchResult[] }>(
                '/api/hopitaux/ai/search-pathology',
                {
                    query,
                    symptoms,
                    lat: location?.lat,
                    lng: location?.lng,
                }
            );

            // Normaliser la réponse pour gérer différents formats
            const resData = (response?.data || response) as any;
            if (response.success) {
                return {
                    success: true,
                    results: resData?.results || resData?.data || [],
                    data: resData || { results: [] }
                };
            } else {
                return {
                    success: false,
                    results: [],
                    message: resData?.message || response.error || 'L\'IA de recherche pathologique n\'est pas encore opérationnelle.'
                };
            }
        } catch (error: any) {
            console.error('[hospitalService] Erreur recherche pathologie:', error);
            return {
                success: false,
                results: [],
                error: error.message || error.error || 'Erreur lors de la recherche. L\'IA de recherche pathologique n\'est peut-être pas encore opérationnelle.'
            };
        }
    },

    // ✅ Temps d'attente en temps réel
    getWaitTimes: async (hospitalId: number) => {
        try {
            const response = await apiGet<any>(
                `/api/hopitaux/${hospitalId}/wait-times`
            );
            return response;
        } catch (error: any) {
            console.warn('[hospitalService] Temps d\'attente non disponibles:', error.message);
            return { success: false, data: { wait_times: [] } };
        }
    },

    // ✅ Statut des urgences
    getEmergencyStatus: async (hospitalId: number) => {
        try {
            const response = await apiGet<any>(
                `/api/hopitaux/${hospitalId}/emergency-status`
            );
            return response;
        } catch (error: any) {
            console.warn('[hospitalService] Statut urgences non disponible:', error.message);
            return { success: false, data: null };
        }
    },

    // ✅ Réserver un RDV en ligne
    bookAppointment: async (
        hospitalId: number,
        bookingData: {
            service_name?: string;
            preferred_date?: string;
            preferred_time?: string;
            notes?: string;
        }
    ) => {
        const response = await apiPost<{
            success: boolean;
            appointment_id: string;
            message: string;
        }>(`/api/hopitaux/${hospitalId}/book`, bookingData);
        return response;
    },

    // ✅ Recherche de services médicaux disponibles (avec système de disponibilité)
    // ✅ Recommandations IA basées sur symptômes
    getAIRecommendations: async (
        symptoms: string,
        location?: string,
        userLocation?: { lat: number; lng: number }
    ) => {
        const response = await apiPost<{ success: boolean; recommendation: HospitalRecommendation }>(
            '/api/hopitaux/ai/recommendations',
            {
                symptoms,
                location,
                lat: userLocation?.lat,
                lng: userLocation?.lng,
            }
        );
        // ✅ CORRIGÉ 2026-03-05: Extraction correcte des données IA imbriquées
        // apiPost wrappe: response.data = backend JSON complet
        // Backend retourne: {success, data: {recommendations: [...]}}
        const backendData = (response?.data || response) as any;
        const innerData = backendData?.data || backendData;
        // Normaliser: la screen attend .recommendation (singulier)
        const recommendation = innerData?.recommendation || innerData?.recommendations || innerData;
        return { success: response.success, data: { recommendation }, error: response.error };
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

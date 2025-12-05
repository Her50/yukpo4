// ✅ Service API pour Hôpitaux - Nouvelles fonctionnalités IA
import { apiGet, apiPost } from './api';

// Types pour les réponses
export interface HospitalRecommendation {
    hospital_ids: number[];
    specialties: string[];
    urgency_level?: number;
    recommendations: string;
    advice: string;
}

export interface EmergencySeverityAnalysis {
    severity_level: number;
    is_critical: boolean;
    suggested_action: string;
    time_to_treatment_minutes?: number;
    reasoning: string;
}

export interface WaitTime {
    specialty: string | null;
    avg_wait_time_minutes: number | null;
    max_wait_time_minutes: number | null;
    consultation_count: number | null;
}

export interface EmergencyStatus {
    status: 'available' | 'busy' | 'saturated';
    critical_count: number;
    moderate_count: number;
    low_count: number;
    total_patients: number;
    avg_wait_time_minutes: number | null;
}

export interface HospitalConsultation {
    id: string;
    hospital_id: number;
    hospital_name: string | null;
    type_etablissement: string | null;
    specialty: string | null;
    consultation_date: string | null;
    status: string | null;
    notes: string | null;
    created_at: string;
}

export interface HospitalAnalytics {
    total_consultations: number;
    consultations_7d: number;
    consultations_30d: number;
    avg_wait_time_minutes: number | null;
    specialties_count: number | null;
}

export const hospitalService = {
    // ✅ Recommandations IA basées sur symptômes
    getAIRecommendations: async (
        symptoms: string,
        location?: string,
        userLocation?: { lat: number; lng: number }
    ) => {
        const response = await apiPost<{ recommendation: HospitalRecommendation }>(
            '/api/hopitaux/ai/recommendations',
            {
                symptoms,
                location,
                user_location: userLocation,
            }
        );
        return response;
    },

    // ✅ Analyse sévérité urgence (triage IA)
    analyzeEmergencySeverity: async (
        symptoms: string,
        age?: number,
        vitalSigns?: any
    ) => {
        const response = await apiPost<{ analysis: EmergencySeverityAnalysis }>(
            '/api/hopitaux/ai/triage',
            {
                symptoms,
                age,
                vital_signs: vitalSigns,
            }
        );
        return response;
    },

    // ✅ Temps d'attente par spécialité
    getWaitTimes: async (hospitalId: number) => {
        const response = await apiGet<{ wait_times: WaitTime[] }>(
            `/api/hopitaux/${hospitalId}/wait-times`
        );
        return response;
    },

    // ✅ Statut des urgences
    getEmergencyStatus: async (hospitalId: number) => {
        const response = await apiGet<EmergencyStatus>(
            `/api/hopitaux/${hospitalId}/emergency-status`
        );
        return response;
    },

    // ✅ Mes consultations (client)
    getMyConsultations: async (page: number = 1, limit: number = 20) => {
        const response = await apiGet<{
            consultations: HospitalConsultation[];
            page: number;
            limit: number;
        }>('/api/hopitaux/my-consultations', {
            params: { page, limit },
        });
        return response;
    },

    // ✅ Analytics prestataire
    getAnalytics: async (hospitalId: number) => {
        const response = await apiGet<{ analytics: HospitalAnalytics }>(
            `/api/hopitaux/${hospitalId}/analytics`
        );
        return response;
    },

    // ✅ Gestion créneaux (prestataire)
    manageSlots: async (
        hospitalId: number,
        slotData: {
            slot_date: string;
            slot_time: string;
            specialty: string;
            doctor_id?: number;
            duration_minutes: number;
            action: 'create' | 'update' | 'delete';
            slot_id?: string;
        }
    ) => {
        const response = await apiPost<{ slot_id: string; message: string }>(
            `/api/hopitaux/${hospitalId}/slots`,
            slotData
        );
        return response;
    },

    // ✅ Détails hôpital (pour vérification propriétaire)
    getHospitalDetails: async (hospitalId: number) => {
        const response = await apiGet<{
            id: number;
            user_id: number;
            nom: string;
            [key: string]: any;
        }>(`/api/hopitaux/${hospitalId}`);
        return response;
    },
};


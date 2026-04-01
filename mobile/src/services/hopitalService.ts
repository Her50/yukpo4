// ✅ Service API pour Hôpitaux et Cliniques
import { apiGet, apiPost } from './api';

// ===== TYPES =====

export interface Hospital {
    id: number;
    service_id?: number;
    nom: string;
    type_etablissement?: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    prestations_medicales?: string[];
    urgences_disponible?: boolean;
    rdv_en_ligne?: boolean;
    telephone?: string;
    whatsapp?: string;
    email?: string;
    is_active?: boolean;
    is_available_now?: boolean;
    distance_km?: number;
    created_at?: string;
}

export interface HospitalSlot {
    id: number;
    service_id: number;
    date: string;
    start_time: string;
    end_time: string;
    available: boolean;
    prestation?: string;
    doctor_name?: string;
    max_bookings?: number;
    current_bookings?: number;
}

export interface HospitalConsultation {
    id: number;
    service_id: number;
    hospital_name?: string;
    service_type: string;
    reservation_date?: string;
    reservation_time?: string;
    status: string;
    notes?: string;
    created_at?: string;
}

export interface HospitalWaitTimes {
    service_id: number;
    emergency_wait_minutes?: number;
    consultation_wait_minutes?: number;
    average_wait_minutes?: number;
    last_updated?: string;
}

export interface HospitalEmergencyStatus {
    service_id: number;
    urgences_disponible: boolean;
    is_available_now: boolean;
    beds_available?: number;
    last_updated?: string;
}

export interface HospitalAnalytics {
    total_consultations?: number;
    consultations_7d?: number;
    consultations_30d?: number;
    average_rating?: number;
    top_prestations?: Array<{ prestation: string; count: number }>;
}

export interface HospitalAiRecommendation {
    service_id: number;
    nom: string;
    type_etablissement?: string;
    relevance_score: number;
    reason?: string;
    prestations?: string[];
    distance_km?: number;
}

export interface EmergencyTriageResult {
    severity: 'critical' | 'high' | 'moderate' | 'low';
    recommended_action: string;
    recommended_services: string[];
    nearest_emergency_hospitals?: HospitalAiRecommendation[];
}

export interface SearchHospitalsParams {
    query?: string;
    ville?: string;
    quartier?: string;
    specialite?: string;
    prestation?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    type_etablissement?: string;
    urgences_only?: boolean;
    available_only?: boolean;
    page?: number;
    limit?: number;
}

export interface BookHospitalParams {
    service_type: string; // 'consultation' | 'rdv' | 'urgence' | 'chirurgie' | etc.
    preferred_date: string; // 'YYYY-MM-DD'
    preferred_time?: string;
    prestation?: string;
    notes?: string;
    slot_id?: number;
}

// ===== SERVICE =====

export const hopitalService = {
    // ===== RECHERCHE (PUBLIC) =====

    /**
     * Rechercher des hôpitaux/cliniques
     * Supporte la recherche par prestation médicale (ex: prestation=Cardiologie)
     * ET par nom de structure (ex: query=Clinique Moderne)
     */
    searchHospitals: async (params: SearchHospitalsParams) => {
        return apiGet<{ success: boolean; hospitals: Hospital[]; total: number }>(
            '/api/hopitaux/search',
            { params }
        );
    },

    /**
     * Détails d'un hôpital
     */
    getHospitalDetails: async (hospitalId: number) => {
        return apiGet<{ success: boolean; hospital: Hospital }>(
            `/api/hopitaux/${hospitalId}`
        );
    },

    /**
     * Autocomplete des services/prestations médicales
     * Permet de chercher "Cardio..." → suggestions ["Cardiologie", "Cardiologie pédiatrique"]
     */
    autocompleteServices: async (query: string, limit: number = 20) => {
        return apiGet<{ success: boolean; services: string[] }>(
            '/api/hopitaux/services/autocomplete',
            { params: { query, limit } }
        );
    },

    /**
     * Recherche IA par pathologie/symptômes → hôpitaux recommandés
     * Ex: query="douleur thoracique" → hôpitaux avec Cardiologie
     */
    searchByPathology: async (query: string, symptoms?: string[]) => {
        return apiPost<{ success: boolean; results: HospitalAiRecommendation[] }>(
            '/api/hopitaux/ai/search-pathology',
            { query, symptoms }
        );
    },

    // ===== CRÉNEAUX ET DISPONIBILITÉ =====

    /**
     * Créneaux disponibles d'un hôpital
     */
    getAvailableSlots: async (hospitalId: number, date?: string, prestation?: string) => {
        return apiGet<{ success: boolean; slots: HospitalSlot[] }>(
            `/api/hopitaux/${hospitalId}/available-slots`,
            { params: { date, prestation } }
        );
    },

    /**
     * Temps d'attente actuels
     */
    getWaitTimes: async (hospitalId: number) => {
        return apiGet<HospitalWaitTimes>(
            `/api/hopitaux/${hospitalId}/wait-times`
        );
    },

    /**
     * Statut urgences en temps réel
     */
    getEmergencyStatus: async (hospitalId: number) => {
        return apiGet<HospitalEmergencyStatus>(
            `/api/hopitaux/${hospitalId}/emergency-status`
        );
    },

    // ===== RÉSERVATION (PROTÉGÉ JWT) =====

    /**
     * Prendre un rendez-vous / réserver une consultation
     * Utilise la table specialized_reservations
     */
    bookHospital: async (hospitalId: number, params: BookHospitalParams) => {
        return apiPost<{ success: boolean; reservation_id: number; message: string }>(
            `/api/hopitaux/${hospitalId}/book`,
            params
        );
    },

    /**
     * Réserver un créneau précis (slot spécifique)
     */
    bookSlot: async (slotId: number, notes?: string) => {
        return apiPost<{ success: boolean; booking_id: number; message: string }>(
            '/api/appointments/book',
            { slot_id: slotId, notes }
        );
    },

    /**
     * Mes consultations / rendez-vous
     */
    getMyConsultations: async () => {
        return apiGet<{ success: boolean; data: HospitalConsultation[] }>(
            '/api/hopitaux/my-consultations'
        );
    },

    // ===== IA (PROTÉGÉ JWT) =====

    /**
     * Recommandations IA d'hôpitaux selon profil médical
     */
    getAiRecommendations: async (params: {
        condition?: string;
        symptoms?: string[];
        urgency?: 'low' | 'moderate' | 'high' | 'critical';
        lat?: number;
        lng?: number;
    }) => {
        return apiPost<{ success: boolean; recommendations: HospitalAiRecommendation[] }>(
            '/api/hopitaux/ai/recommendations',
            params
        );
    },

    /**
     * Triage IA d'urgence — évalue la sévérité et oriente
     */
    aiTriage: async (params: {
        symptoms: string[];
        age?: number;
        medical_history?: string[];
        vital_signs?: Record<string, any>;
    }) => {
        return apiPost<{ success: boolean; triage: EmergencyTriageResult }>(
            '/api/hopitaux/ai/triage',
            params
        );
    },

    // ===== PARTENAIRE (PROTÉGÉ JWT) =====

    /**
     * Créer un hôpital / clinique (partenaire)
     */
    createHospital: async (data: {
        service_id: number;
        nom: string;
        type_etablissement?: string;
        adresse?: string;
        quartier?: string;
        ville?: string;
        gps?: string;
        prestations_medicales?: string[];
        urgences_disponible?: boolean;
        rdv_en_ligne?: boolean;
        telephone?: string;
        whatsapp?: string;
        email?: string;
        planning_hebdomadaire?: Record<string, any>;
    }) => {
        return apiPost<{ success: boolean; hospital: Hospital }>(
            '/api/hopitaux',
            data
        );
    },

    /**
     * Mes hôpitaux (partenaire)
     */
    listMyHospitals: async () => {
        return apiGet<{ success: boolean; hospitals: Hospital[] }>(
            '/api/hopitaux'
        );
    },

    /**
     * Gérer les créneaux d'un hôpital (partenaire)
     */
    manageSlots: async (hospitalId: number, slots: Array<{
        date: string;
        start_time: string;
        end_time: string;
        prestation?: string;
        doctor_name?: string;
        max_bookings?: number;
    }>) => {
        return apiPost<{ success: boolean; created: number }>(
            `/api/hopitaux/${hospitalId}/slots`,
            { slots }
        );
    },

    /**
     * Analytics de l'hôpital (partenaire)
     */
    getAnalytics: async (hospitalId: number) => {
        return apiGet<{ success: boolean; analytics: HospitalAnalytics }>(
            `/api/hopitaux/${hospitalId}/analytics`
        );
    },
};

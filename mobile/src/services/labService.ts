// ✅ Service API pour Laboratoires - Nouvelles fonctionnalités IA
import { apiGet, apiPost } from './api';

// Types pour les réponses
export interface LabAnalysisResult {
    interpretation: string;
    anomalies_detected: Anomaly[];
    is_normal: boolean;
    confidence: number; // 0.0-1.0
    recommendations: string[];
    follow_up_exams: string[];
}

export interface Anomaly {
    parameter: string;
    value: string;
    normal_range: string;
    severity: 'critical' | 'high' | 'moderate' | 'low';
    description: string;
}

export interface ExaminationType {
    id: number;
    name: string;
    category: string | null;
    description: string | null;
    price: number | null;
    duration_minutes: number | null;
    requires_fasting: boolean;
    preparation_instructions: string | null;
}

export interface LabExamination {
    id: string;
    laboratory_id: number;
    laboratory_name: string | null;
    examination_type_id: number;
    examination_type_name: string | null;
    status: string | null;
    results: any | null;
    notes: string | null;
    examination_date: string | null;
    created_at: string;
}

export interface LabAnalytics {
    total_examinations: number;
    examinations_7d: number;
    examinations_30d: number;
    avg_completion_time_hours: number | null;
    examination_types_count: number | null;
}

export const labService = {
    // ✅ Obtenir les types d'examens disponibles
    getExaminationTypes: async (laboratoryId: number) => {
        const response = await apiGet<{ examination_types: ExaminationType[] }>(
            `/api/laboratoires/${laboratoryId}/examination-types`
        );
        return response;
    },

    // ✅ Réserver un examen
    bookExamination: async (
        laboratoryId: number,
        bookingData: {
            examination_type_id: number;
            notes?: string;
            requested_date?: string;
        }
    ) => {
        const response = await apiPost<{
            examination_id: string;
            message: string;
            status: string;
        }>(`/api/laboratoires/${laboratoryId}/book-examination`, bookingData);
        return response;
    },

    // ✅ Obtenir les résultats d'examen
    getExaminationResults: async (examinationId: string) => {
        const response = await apiGet<{
            examination: LabExamination;
            results: any;
        }>(`/api/laboratoires/examinations/${examinationId}/results`);
        return response;
    },

    // ✅ Analyser les résultats avec IA
    analyzeExamination: async (
        examinationId: string,
        patientAge?: number,
        patientSex?: string
    ) => {
        const response = await apiPost<{ analysis: LabAnalysisResult }>(
            `/api/laboratoires/examinations/${examinationId}/analyze`,
            {
                patient_age: patientAge,
                patient_sex: patientSex,
            }
        );
        return response;
    },

    // ✅ Mes examens (client)
    getMyExaminations: async (page: number = 1, limit: number = 20) => {
        const response = await apiGet<{
            examinations: LabExamination[];
            page: number;
            limit: number;
        }>('/api/laboratoires/my-examinations', {
            params: { page, limit },
        });
        return response;
    },

    // ✅ Autocomplete types d'examens
    autocompleteExaminationTypes: async (query: string) => {
        const response = await apiGet<{ suggestions: string[] }>(
            '/api/laboratoires/examinations/autocomplete',
            { params: { q: query } }
        );
        return response;
    },

    // ✅ Analyser image de résultats (IA)
    analyzeExaminationImage: async (imageUrl: string, examinationType?: string) => {
        const response = await apiPost<{ success: boolean; analysis: LabAnalysisResult }>(
            '/api/laboratoires/examinations/analyze-image',
            {
                image_url: imageUrl,
                examination_type: examinationType,
            }
        );
        return response;
    },

    // ✅ Recherche pathologie IA
    searchPathology: async (symptoms: string[], patientAge?: number, patientSex?: string) => {
        const response = await apiPost<{
            success: boolean;
            data: {
                suggested_examinations: string[];
                possible_pathologies: string[];
                urgency_level: string;
                recommendations: string;
            };
        }>(
            '/api/laboratoires/ai/search-pathology',
            {
                symptoms,
                patient_age: patientAge,
                patient_sex: patientSex,
            }
        );
        return response;
    },

    // ✅ Analytics prestataire
    getAnalytics: async (laboratoryId: number) => {
        const response = await apiGet<{ analytics: LabAnalytics }>(
            `/api/laboratoires/${laboratoryId}/analytics`
        );
        return response;
    },

    // ✅ Détails laboratoire (pour vérification propriétaire)
    getLaboratoryDetails: async (laboratoryId: number) => {
        const response = await apiGet<{
            id: number;
            user_id: number;
            nom: string;
            [key: string]: any;
        }>(`/api/laboratoires/${laboratoryId}`);
        return response;
    },
};

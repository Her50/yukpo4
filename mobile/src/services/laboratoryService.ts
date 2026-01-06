// ✅ Service API pour Laboratoires avec fonctionnalités IA
import { apiGet, apiPost } from './api';

// Types pour les examens
export interface ExaminationType {
    id: number;
    name: string;
    category?: string;
    description?: string;
    price?: number;
    duration_minutes?: number;
    requires_fasting?: boolean;
    laboratory_id?: number;
    laboratory_name?: string;
}

export interface ExaminationResult {
    id: number;
    examination_id: number;
    examination_type: string;
    results: any; // JSON des résultats
    images?: string[]; // URLs des images de résultats
    status: 'pending' | 'completed' | 'cancelled';
    created_at: string;
    completed_at?: string;
}

export interface LabAnalysisResult {
    interpretation: string;
    anomalies_detected: Array<{
        parameter: string;
        value: string;
        normal_range: string;
        severity: 'critical' | 'high' | 'moderate' | 'low';
        description: string;
    }>;
    is_normal: boolean;
    confidence: number;
    recommendations: string[];
    follow_up_exams: string[];
}

export interface PathologySearchResult {
    pathology_name: string;
    description: string;
    symptoms: string[];
    recommended_examinations: string[];
    urgency_level: 'critical' | 'high' | 'moderate' | 'low';
    recommendations: string[];
}

export const laboratoryService = {
    // ✅ Autocomplete des types d'examens
    searchExaminationTypes: async (query: string, limit: number = 20) => {
        const response = await apiGet<{ success: boolean; examinations: ExaminationType[] }>(
            '/api/laboratoires/examinations/autocomplete',
            { params: { query, limit } }
        );
        return response;
    },

    // ✅ Obtenir les types d'examens d'un laboratoire spécifique
    getLaboratoryExaminationTypes: async (laboratoryId: number) => {
        const response = await apiGet<{ success: boolean; data: ExaminationType[] }>(
            `/api/laboratoires/${laboratoryId}/examination-types`
        );
        return response;
    },

    // ✅ Analyser les résultats d'un examen avec IA
    analyzeExaminationResults: async (
        examinationId: number,
        results?: any,
        patientAge?: number,
        patientSex?: string
    ) => {
        const response = await apiPost<{ success: boolean; analysis: LabAnalysisResult }>(
            `/api/laboratoires/examinations/${examinationId}/analyze`,
            {
                results,
                patient_age: patientAge,
                patient_sex: patientSex,
            }
        );
        return response;
    },

    // ✅ Analyser une image de résultat d'examen avec IA
    analyzeExaminationImage: async (
        imageUri: string,
        examinationType: string,
        patientAge?: number,
        patientSex?: string
    ) => {
        // Note: L'upload d'image sera géré séparément, ici on envoie l'URL ou base64
        const response = await apiPost<{ success: boolean; analysis: LabAnalysisResult }>(
            '/api/laboratoires/examinations/analyze-image',
            {
                image_uri: imageUri,
                examination_type: examinationType,
                patient_age: patientAge,
                patient_sex: patientSex,
            }
        );
        return response;
    },

    // ✅ Recherche IA de pathologie
    searchPathology: async (query: string, symptoms?: string[]) => {
        const response = await apiPost<{ success: boolean; results: PathologySearchResult[] }>(
            '/api/laboratoires/ai/search-pathology',
            {
                query,
                symptoms,
            }
        );
        return response;
    },

    // ✅ Obtenir mes examens
    getMyExaminations: async () => {
        const response = await apiGet<{ success: boolean; data: ExaminationResult[] }>(
            '/api/laboratoires/my-examinations'
        );
        return response;
    },

    // ✅ Obtenir les résultats d'un examen
    getExaminationResults: async (examinationId: number) => {
        const response = await apiGet<{ success: boolean; results: ExaminationResult }>(
            `/api/laboratoires/examinations/${examinationId}/results`
        );
        return response;
    },
};


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

export interface LaboratoryAvailability {
    service_id: number;
    service_title: string;
    available_examinations: string[];
    current_schedule?: { [key: string]: any };
    is_24h: boolean;
    distance_km?: number;
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
        try {
            // Note: L'upload d'image sera géré séparément, ici on envoie l'URL ou base64
            const response = await apiPost<{ success: boolean; analysis?: LabAnalysisResult; data?: { analysis?: LabAnalysisResult } }>(
                '/api/laboratoires/examinations/analyze-image',
                {
                    image_uri: imageUri,
                    image_base64: imageUri, // Support des deux formats
                    examination_type: examinationType,
                    patient_age: patientAge,
                    patient_sex: patientSex,
                }
            );

            // Normaliser la réponse
            if (response.success) {
                const r = response.data as any;
                return {
                    success: true,
                    data: {
                        analysis: r?.analysis || r
                    }
                };
            } else {
                const r = response.data as any;
                return {
                    success: false,
                    error: r?.message || response.error || 'L\'IA d\'analyse d\'images n\'est pas encore opérationnelle.'
                };
            }
        } catch (error: any) {
            console.error('[laboratoryService] Erreur analyse image:', error);
            return {
                success: false,
                error: error.message || error.error || 'Erreur lors de l\'analyse. L\'IA d\'analyse d\'images n\'est peut-être pas encore opérationnelle.'
            };
        }
    },

    // ✅ Recherche IA de pathologie
    searchPathology: async (query: string, symptoms?: string[]) => {
        try {
            const response = await apiPost<{ success: boolean; results?: PathologySearchResult[]; data?: PathologySearchResult[] }>(
                '/api/laboratoires/ai/search-pathology',
                {
                    query,
                    symptoms,
                }
            );

            // Normaliser la réponse pour gérer différents formats
            if (response.success) {
                const r = response.data as any;
                return {
                    success: true,
                    results: r?.results || r || [],
                    data: r || { results: r?.results || [] }
                };
            } else {
                const r = response.data as any;
                return {
                    success: false,
                    results: [],
                    message: r?.message || response.error || 'L\'IA de recherche pathologique n\'est pas encore opérationnelle.'
                };
            }
        } catch (error: any) {
            console.error('[laboratoryService] Erreur recherche pathologie:', error);
            return {
                success: false,
                results: [],
                error: error.message || error.error || 'Erreur lors de la recherche. L\'IA de recherche pathologique n\'est peut-être pas encore opérationnelle.'
            };
        }
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

    // ✅ Recherche avec système de disponibilité (utilise search_with_scheduling)
    searchWithAvailability: async (
        query: string,
        location?: { lat: number; lng: number },
        maxDistance?: number
    ) => {
        const response = await apiGet<{
            results: Array<{
                service_id: number;
                product_data: any;
                relevance_score: number;
                distance_km?: number;
                is_available_now: boolean;
                availability_info: string;
            }>;
            total: number;
            search_intent: string;
        }>(
            '/api/search/scheduling',
            {
                params: {
                    query,
                    lat: location?.lat,
                    lng: location?.lng,
                    max_distance: maxDistance || 50,
                }
            }
        );
        return response;
    },
};


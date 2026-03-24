// ✅ Service API TypeScript pour Orientation Scolaire avec IA

import { apiGet, apiPost } from './api';

// Types
export interface StudentProfile {
    id: number;
    user_id: number;
    nom_complet: string;
    date_naissance?: string;
    ville?: string;
    region?: string;
    gps?: string;
    niveau_actuel?: string;
    classe_actuelle?: string;
    etablissement_actuel?: string;
    notes_moyennes: Record<string, number>;
    moyenne_generale?: number;
    classement?: number;
    effectif_classe?: number;
    matieres_preferees: string[];
    matieres_faibles: string[];
    objectifs_carriere: string[];
    secteurs_interets: string[];
    budget_max?: number;
    preference_localisation: string[];
    preference_type_etablissement: string[];
    is_complete: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateOrUpdateStudentProfileRequest {
    nom_complet: string;
    date_naissance?: string;
    ville?: string;
    region?: string;
    gps?: string;
    niveau_actuel?: string;
    classe_actuelle?: string;
    etablissement_actuel?: string;
    notes_moyennes?: Record<string, number>;
    moyenne_generale?: number;
    classement?: number;
    effectif_classe?: number;
    matieres_preferees?: string[];
    matieres_faibles?: string[];
    objectifs_carriere?: string[];
    secteurs_interets?: string[];
    budget_max?: number;
    preference_localisation?: string[];
    preference_type_etablissement?: string[];
}

export interface AnalyzeProfileRequest {
    profile_id: number;
}

export interface AnalyzeProfileResponse {
    profile_id: number;
    score_academique: number;
    score_interets: number;
    points_forts: string[];
    points_faibles: string[];
    filieres_suggestees: string[];
    etablissements_suggestes: number[];
    reasoning: string;
    recommendations: string;
}

export interface GenerateRecommendationsRequest {
    student_profile_id: number;
    etablissement_id?: number;
    filiere?: string;
    specialite?: string;
    budget_max?: number;
    preference_localisation?: string[];
}

export interface ProgramRecommendationResponse {
    etablissement_id: number;
    filiere: string;
    specialite?: string;
    score_total: number;
    score_academique: number;
    score_interets: number;
    score_budget: number;
    score_localisation: number;
    reasoning: string;
    points_forts: string[];
    points_faibles: string[];
    alternatives: number[];
}

export interface CompareProgramsRequest {
    student_profile_id: number;
    etablissement_1_id: number;
    etablissement_2_id: number;
    filiere_1: string;
    filiere_2: string;
    specialite_1?: string;
    specialite_2?: string;
}

export interface ProgramComparisonResponse {
    etablissement_1_id: number;
    etablissement_2_id: number;
    filiere_1: string;
    filiere_2: string;
    score_etablissement_1: number;
    score_etablissement_2: number;
    winner_etablissement_id: number;
    winner_reasoning: string;
    comparison_details: Record<string, any>;
}

// API Functions
export const orientationScolaireApi = {
    // Obtenir mon profil
    getMyProfile: async (): Promise<StudentProfile | null> => {
        const response = await apiGet<{ profile: StudentProfile }>('/api/orientation/my-profile');
        return response.profile || response.data?.profile || null;
    },

    // Créer ou mettre à jour le profil
    createOrUpdateProfile: async (data: CreateOrUpdateStudentProfileRequest): Promise<StudentProfile> => {
        const response = await apiPost<{ profile: StudentProfile }>(
            '/api/orientation/my-profile',
            data
        );
        return response.profile || response.data?.profile || response;
    },

    // Analyser le profil avec IA
    analyzeProfile: async (profile_id: number): Promise<AnalyzeProfileResponse> => {
        const response = await apiPost<{ success: boolean; analysis: AnalyzeProfileResponse }>(
            '/api/orientation/ai/analyze-profile',
            { profile_id }
        );
        return response.analysis || response.data?.analysis || response;
    },

    // Obtenir des recommandations IA
    getRecommendations: async (request: GenerateRecommendationsRequest): Promise<ProgramRecommendationResponse> => {
        const response = await apiPost<{ success: boolean; recommendation: ProgramRecommendationResponse }>(
            '/api/orientation/ai/recommendations',
            request
        );
        return response.recommendation || response.data?.recommendation || response;
    },

    // Comparer des programmes
    comparePrograms: async (request: CompareProgramsRequest): Promise<ProgramComparisonResponse> => {
        const response = await apiPost<{ success: boolean; comparison: ProgramComparisonResponse }>(
            '/api/orientation/ai/compare-programs',
            request
        );
        return response.comparison || response.data?.comparison || response;
    },

    // Obtenir analytics
    getAnalytics: async (etablissement_id?: number): Promise<any> => {
        const params = etablissement_id ? { etablissement_id } : {};
        const response = await apiGet<{ analytics: any }>(
            '/api/orientation/analytics',
            { params }
        );
        return response.analytics || response.data?.analytics || response;
    },

    /** Établissements rattachés au compte (JWT) — tableau de bord partenaire + rattachement manuels Yukpo */
    getMyEtablissements: async (): Promise<{
        etablissements: Array<{ id: number; nom_etablissement: string; ville: string; gps?: string | null }>;
    }> => {
        const response = await apiGet<{
            success?: boolean;
            data?: { etablissements?: any[] };
        }>('/api/orientation/etablissements/mine');
        const data = (response as any)?.data ?? response;
        const etablissements = data?.etablissements ?? [];
        return { etablissements };
    },
};


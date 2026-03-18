// ✅ Service API pour Orientation Scolaire avec toutes les fonctionnalités backend
import { apiGet, apiPost } from './api';

// Types pour les établissements
export interface EtablissementScolaire {
    id: number;
    service_id: number;
    user_id: number;
    nom_etablissement: string;
    type_etablissement: string; // 'primaire', 'secondaire', 'superieur'
    sous_type?: string;
    niveau_min?: number;
    niveau_max?: number;
    adresse?: string;
    quartier?: string;
    ville: string;
    region?: string;
    gps?: string;
    telephone?: string;
    email?: string;
    site_web?: string;
    filieres: string[];
    specialites: string[];
    langues_enseignement: string[];
    statistiques_examens?: any;
    is_active: boolean;
    is_verified: boolean;
    created_at: string;
    updated_at: string;
    distance_km?: number;
}

export interface ProgrammeScolaire {
    id: number;
    etablissement_id: number;
    type_etablissement: string;
    niveau: string;
    classe?: string;
    filiere?: string;
    specialite?: string;
    titre: string;
    description?: string;
    annee_scolaire: string;
    fichier_url?: string;
    fichier_nom?: string;
    fichier_taille?: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface FournituresScolaires {
    id: number;
    etablissement_id: number;
    type_etablissement: string;
    niveau: string;
    classe?: string;
    annee_scolaire: string;
    liste_fournitures: any;
    fichier_url?: string;
    fichier_nom?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ConcoursEntree {
    id: number;
    etablissement_id: number;
    titre: string;
    description?: string;
    type_concours: string;
    date_concours: string;
    date_limite_inscription?: string;
    lieu?: string;
    frais_inscription?: number;
    nombre_places?: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ConferenceLive {
    id: number;
    etablissement_id?: number;
    titre: string;
    description?: string;
    date_debut: string;
    date_fin?: string;
    lien_live?: string;
    nombre_participants: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface SearchEtablissementsFilters {
    type_etablissement?: string;
    ville?: string;
    region?: string;
    filiere?: string;
    specialite?: string;
    gps_lat?: number;
    gps_lon?: number;
    rayon_km?: number;
    page?: number;
    limit?: number;
}

export interface StudentProfileAnalysis {
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

export interface ProgramRecommendation {
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

export interface ProgramComparison {
    etablissement_1_id: number;
    etablissement_2_id: number;
    filiere_1: string;
    filiere_2: string;
    score_etablissement_1: number;
    score_etablissement_2: number;
    winner_etablissement_id: number;
    winner_reasoning: string;
    comparison_details: any;
}

export const orientationScolaireService = {
    // ✅ Recherche d'établissements
    searchEtablissements: async (filters: SearchEtablissementsFilters) => {
        const response = await apiGet<{ success: boolean; data: EtablissementScolaire[]; pagination: any }>(
            '/api/orientation-scolaire/etablissements/search',
            { params: filters }
        );
        return response;
    },

    // ✅ Détails d'un établissement
    getEtablissementDetails: async (etablissementId: number) => {
        const response = await apiGet<{ success: boolean; data: EtablissementScolaire }>(
            `/api/orientation-scolaire/etablissements/${etablissementId}`
        );
        return response;
    },

    // ✅ Suggestions intelligentes d'établissements
    suggestEtablissements: async (type: string, domaine?: string, filiere?: string, ville?: string, region?: string, lat?: number, lng?: number) => {
        const response = await apiGet<{ success: boolean; data: EtablissementScolaire[] }>(
            '/api/orientation-scolaire/etablissements/suggest',
            {
                params: {
                    type_etablissement: type,
                    domaine,
                    filiere,
                    ville,
                    region,
                    gps_lat: lat,
                    gps_lon: lng,
                },
            }
        );
        return response;
    },

    // ✅ Programmes scolaires
    searchProgrammes: async (etablissementId?: number, type?: string, niveau?: string, filiere?: string, annee?: string, page?: number, limit?: number) => {
        const response = await apiGet<{ success: boolean; data: ProgrammeScolaire[]; pagination: any }>(
            '/api/orientation-scolaire/programmes/search',
            {
                params: {
                    etablissement_id: etablissementId,
                    type_etablissement: type,
                    niveau,
                    filiere,
                    annee_scolaire: annee,
                    page,
                    limit,
                },
            }
        );
        return response;
    },

    getProgrammesByEtablissement: async (etablissementId: number, page?: number, limit?: number) => {
        const response = await apiGet<{ success: boolean; data: ProgrammeScolaire[]; pagination: any }>(
            `/api/orientation-scolaire/etablissements/${etablissementId}/programmes`,
            { params: { page, limit } }
        );
        return response;
    },

    // ✅ Fournitures scolaires
    searchFournitures: async (etablissementId?: number, type?: string, niveau?: string, classe?: string, annee?: string, page?: number, limit?: number) => {
        const response = await apiGet<{ success: boolean; data: FournituresScolaires[]; pagination: any }>(
            '/api/orientation-scolaire/fournitures/search',
            {
                params: {
                    etablissement_id: etablissementId,
                    type_etablissement: type,
                    niveau,
                    classe,
                    annee_scolaire: annee,
                    page,
                    limit,
                },
            }
        );
        return response;
    },

    getFournituresByEtablissement: async (etablissementId: number, page?: number, limit?: number) => {
        const response = await apiGet<{ success: boolean; data: FournituresScolaires[]; pagination: any }>(
            `/api/orientation-scolaire/etablissements/${etablissementId}/fournitures`,
            { params: { page, limit } }
        );
        return response;
    },

    // ✅ Concours d'entrée
    listConcoursActifs: async () => {
        const response = await apiGet<{ success: boolean; data: ConcoursEntree[] }>(
            '/api/orientation-scolaire/concours/actifs'
        );
        return response;
    },

    searchConcours: async (etablissementId?: number, type?: string, page?: number, limit?: number) => {
        const response = await apiGet<{ success: boolean; data: ConcoursEntree[]; pagination: any }>(
            '/api/orientation-scolaire/concours/search',
            {
                params: {
                    etablissement_id: etablissementId,
                    type_concours: type,
                    page,
                    limit,
                },
            }
        );
        return response;
    },

    getConcoursDetails: async (concoursId: number) => {
        const response = await apiGet<{ success: boolean; data: ConcoursEntree }>(
            `/api/orientation-scolaire/concours/${concoursId}`
        );
        return response;
    },

    // ✅ Conférences
    listConferencesProgrammees: async () => {
        const response = await apiGet<{ success: boolean; data: ConferenceLive[] }>(
            '/api/orientation-scolaire/conferences/programmees'
        );
        return response;
    },

    searchConferences: async (etablissementId?: number, page?: number, limit?: number) => {
        const response = await apiGet<{ success: boolean; data: ConferenceLive[]; pagination: any }>(
            '/api/orientation-scolaire/conferences/search',
            {
                params: {
                    etablissement_id: etablissementId,
                    page,
                    limit,
                },
            }
        );
        return response;
    },

    getConferenceDetails: async (conferenceId: number) => {
        const response = await apiGet<{ success: boolean; data: ConferenceLive }>(
            `/api/orientation-scolaire/conferences/${conferenceId}`
        );
        return response;
    },

    // ✅ Fonctionnalités IA
    analyzeProfile: async (profileId: number) => {
        const response = await apiPost<{ success: boolean; analysis: StudentProfileAnalysis }>(
            '/api/orientation/ai/analyze-profile',
            { profile_id: profileId }
        );
        return response;
    },

    getRecommendations: async (profileId: number, typeEtablissement: string, domaine?: string, filiere?: string, budgetMax?: number, preferencesLocalisation?: string[]) => {
        const response = await apiPost<{ success: boolean; recommendation: ProgramRecommendation }>(
            '/api/orientation/ai/recommendations',
            {
                student_profile_id: profileId,
                type_etablissement: typeEtablissement,
                domaine,
                filiere,
                budget_max: budgetMax,
                preference_localisation: preferencesLocalisation,
            }
        );
        // Le backend retourne un seul recommendation, on le convertit en tableau pour l'UI
        if (response.success && response.data?.recommendation) {
            return {
                ...response,
                data: {
                    ...response.data,
                    recommendations: [response.data.recommendation],
                },
            };
        }
        return response;
    },

    comparePrograms: async (
        profileId: number,
        etablissement1Id: number,
        etablissement2Id: number,
        filiere1: string,
        filiere2: string,
        specialite1?: string,
        specialite2?: string
    ) => {
        const response = await apiPost<{ success: boolean; comparison: ProgramComparison }>(
            '/api/orientation/ai/compare-programs',
            {
                student_profile_id: profileId,
                etablissement_1_id: etablissement1Id,
                etablissement_2_id: etablissement2Id,
                filiere_1: filiere1,
                filiere_2: filiere2,
                specialite_1: specialite1,
                specialite_2: specialite2,
            }
        );
        return response;
    },

    // ✅ Profil étudiant
    getMyProfile: async () => {
        const response = await apiGet<{ success: boolean; profile: any }>(
            '/api/orientation/my-profile'
        );
        return response;
    },

    // ✅ Créer / mettre à jour mon profil étudiant
    createOrUpdateMyProfile: async (profile: Record<string, any>) => {
        const response = await apiPost<{ success: boolean; profile: any }>(
            '/api/orientation/my-profile',
            profile
        );
        return response;
    },

    // ✅ Analytics orientation
    getAnalytics: async (etablissementId?: number) => {
        const response = await apiGet<{ success: boolean; analytics: any }>(
            '/api/orientation/analytics',
            { params: etablissementId ? { etablissement_id: etablissementId } : {} }
        );
        return response;
    },

    // ✅ Recherche académique IA
    academicSearch: async (query: string, context?: Record<string, any>) => {
        const response = await apiPost<{ success: boolean; response: string }>(
            '/api/orientation/ai/academic-search',
            {
                query,
                context: context || { service: 'orientation_scolaire', domain: 'education' },
            }
        );
        return response;
    },

    // ✅ Rejoindre une conférence live
    joinConference: async (conferenceId: number) => {
        const response = await apiPost<{ success: boolean; data: any }>(
            `/api/orientation-scolaire/conferences/${conferenceId}/join`,
            {}
        );
        return response;
    },
};


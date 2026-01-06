// ✅ Service API pour Offres d'Emploi avec toutes les fonctionnalités backend
import { apiGet, apiPost, apiPatch } from './api';

// Types pour les offres d'emploi
export interface OffreEmploi {
    id: number;
    entreprise_id: number;
    titre_poste: string;
    description: string;
    type_contrat: string;
    duree_contrat?: number;
    lieu_travail: string;
    adresse?: string;
    gps?: string;
    remote: boolean;
    remote_partiel: boolean;
    salaire_min?: number;
    salaire_max?: number;
    devise: string;
    salaire_negociable: boolean;
    niveau_etude?: string;
    experience_min?: number;
    competences_requises?: string[];
    langues_requises?: any;
    permis_requis?: string[];
    secteur: string;
    domaine?: string;
    tags?: string[];
    date_publication: string;
    date_limite_candidature?: string;
    date_debut_poste?: string;
    statut: string;
    nombre_candidatures: number;
    nombre_vues: number;
    is_active: boolean;
    is_verified: boolean;
    created_at: string;
    updated_at: string;
    distance_km?: number;
}

export interface SearchOffresFilters {
    query?: string;
    secteur?: string;
    type_contrat?: string;
    lieu_travail?: string;
    salaire_min?: number;
    salaire_max?: number;
    remote?: boolean;
    niveau_etude?: string;
    experience_min?: number;
    competences?: string[];
    page?: number;
    limit?: number;
    lat?: number;
    lng?: number;
    rayon_km?: number;
}

export interface CreateOffreRequest {
    titre_poste: string;
    description: string;
    type_contrat: string;
    duree_contrat?: number;
    lieu_travail: string;
    adresse?: string;
    gps?: string;
    remote: boolean;
    remote_partiel: boolean;
    salaire_min?: number;
    salaire_max?: number;
    devise: string;
    salaire_negociable: boolean;
    niveau_etude?: string;
    experience_min?: number;
    competences_requises?: string[];
    langues_requises?: any;
    permis_requis?: string[];
    secteur: string;
    domaine?: string;
    tags?: string[];
    date_limite_candidature?: string;
    date_debut_poste?: string;
}

export interface Candidature {
    id: number;
    offre_id: number;
    candidat_id: number;
    profil_id?: number;
    lettre_motivation?: string;
    cv_url?: string;
    statut: string;
    score_matching?: number;
    date_candidature: string;
}

export interface MatchingOffre {
    offre: OffreEmploi;
    score_total: number;
    score_competences?: number;
    score_experience?: number;
    competences_match?: string[];
    competences_manquantes?: string[];
}

export interface CVAnalysis {
    score_global: number;
    points_forts: string[];
    points_faibles: string[];
    suggestions_amelioration: string[];
    competences_identifiees: string[];
    competences_manquantes: string[];
    recommandations: string[];
}

export interface SalaryPrediction {
    salaire_estime_min: number;
    salaire_estime_max: number;
    salaire_estime_median: number;
    devise: string;
    facteurs_influence: string[];
    comparaison_marche: string;
    confidence: number;
}

export interface FormationSuggestion {
    formation: string;
    raison: string;
    urgence: 'high' | 'medium' | 'low';
    duree_estimee?: string;
}

export const offreEmploiService = {
    // ✅ Recherche d'offres d'emploi (publique)
    searchOffres: async (filters: SearchOffresFilters) => {
        const response = await apiGet<{ success: boolean; data: OffreEmploi[]; total: number }>(
            '/api/offres-emploi/search',
            { params: filters }
        );
        return response;
    },

    // ✅ Détails d'une offre (publique)
    getOffreDetails: async (offreId: number) => {
        const response = await apiGet<{ success: boolean; data: OffreEmploi }>(
            `/api/offres-emploi/${offreId}`
        );
        return response;
    },

    // ✅ Créer une offre d'emploi (employeur)
    createOffre: async (offre: CreateOffreRequest) => {
        const response = await apiPost<{ success: boolean; data: OffreEmploi }>(
            '/api/offres-emploi',
            offre
        );
        return response;
    },

    // ✅ Mes offres (employeur)
    getMesOffres: async (page: number = 1, limit: number = 20) => {
        const response = await apiGet<{ success: boolean; data: OffreEmploi[]; total: number }>(
            '/api/offres-emploi',
            { params: { page, limit } }
        );
        return response;
    },

    // ✅ Offres correspondantes (candidat avec matching)
    getMatchingOffres: async (minScore?: number, limit?: number) => {
        const response = await apiGet<{ success: boolean; data: MatchingOffre[] }>(
            '/api/offres-emploi/matching/offres',
            { params: { min_score: minScore, limit } }
        );
        return response;
    },

    // ✅ Créer une candidature
    createCandidature: async (offreId: number, lettreMotivation?: string, cvUrl?: string) => {
        const response = await apiPost<{ success: boolean; data: Candidature }>(
            '/api/offres-emploi/candidatures',
            {
                offre_id: offreId,
                lettre_motivation: lettreMotivation,
                cv_url: cvUrl,
            }
        );
        return response;
    },

    // ✅ Mes candidatures
    getMesCandidatures: async (statut?: string, page: number = 1, limit: number = 20) => {
        const response = await apiGet<{ success: boolean; data: Candidature[]; total: number }>(
            '/api/offres-emploi/mes-candidatures',
            { params: { statut, page, limit } }
        );
        return response;
    },

    // ✅ Analyse CV IA
    analyzeCV: async (cvUrl: string, offreId?: number) => {
        const response = await apiPost<{ success: boolean; analysis: CVAnalysis }>(
            '/api/offres-emploi/ai/analyze-cv',
            {
                cv_url: cvUrl,
                offre_id: offreId,
            }
        );
        return response;
    },

    // ✅ Prédiction salaire IA
    predictSalary: async (
        titrePoste: string,
        secteur: string,
        experience: number,
        competences: string[],
        lieuTravail?: string
    ) => {
        const params: any = {
            titre_poste: titrePoste,
            secteur,
            experience_annees: experience,
            niveau_etude: 'Non spécifié',
        };
        if (lieuTravail) params.ville = lieuTravail;
        if (competences.length > 0) params.competences = competences;

        const response = await apiGet<{ success: boolean; prediction: SalaryPrediction }>(
            '/api/offres-emploi/ai/salary-prediction',
            { params }
        );
        return response;
    },

    // ✅ Suggestions formations IA
    suggestFormations: async (competencesManquantes: string[], objectifCarriere?: string) => {
        const response = await apiPost<{ success: boolean; suggestions: FormationSuggestion[] }>(
            '/api/offres-emploi/ai/suggest-formations',
            {
                competences_manquantes: competencesManquantes,
                objectif_carriere: objectifCarriere,
            }
        );
        return response;
    },

    // ✅ Matching IA amélioré
    aiMatching: async (offreId: number, candidatId: number) => {
        const response = await apiPost<{ success: boolean; matching: any }>(
            '/api/offres-emploi/ai/matching',
            {
                offre_id: offreId,
                candidat_id: candidatId,
            }
        );
        return response;
    },

    // ✅ Dashboard candidat
    getDashboardCandidat: async () => {
        const response = await apiGet<{ success: boolean; data: any }>(
            '/api/offres-emploi/dashboard/candidat'
        );
        return response;
    },

    // ✅ Dashboard employeur
    getDashboardEmployeur: async () => {
        const response = await apiGet<{ success: boolean; data: any }>(
            '/api/offres-emploi/dashboard/employeur'
        );
        return response;
    },
};


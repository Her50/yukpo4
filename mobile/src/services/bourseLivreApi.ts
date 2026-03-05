// ✅ Service API TypeScript pour Bourse du Livre avec IA

import { apiGet, apiPost } from './api';

// Types
export interface BookRecommendationRequest {
    classe_actuelle: string;
    classe_souhaitee: string;
    matiere: string;
    niveau?: string;
    ville?: string;
}

export interface BookRecommendationResponse {
    livre_ids: number[];
    score_recommendation: number;
    reasoning: string;
    alternative_books: number[];
    matieres_suggestees: string[];
}

export interface BookMatchingRequest {
    livre_offert_id: number;
    livre_souhaite_id: number;
    participant_id: number;
    distance_km?: number;
    etat_livre_offert?: string;
    etat_livre_souhaite?: string;
}

export interface BookMatchingResponse {
    livre_offert_id: number;
    livre_souhaite_id: number;
    participant_id: number;
    score_matching: number;
    score_compatibilite: number;
    score_proximite: number;
    reasoning: string;
    points_forts: string[];
    points_faibles: string[];
}

export interface PriceSuggestionRequest {
    livre_id: number;
    titre: string;
    auteur?: string;
    editeur?: string;
    isbn?: string;
    classe: string;
    matiere: string;
    etat_livre: string;
    ville?: string;
    prix_marche?: number;
}

export interface PriceSuggestionResponse {
    livre_id: number;
    prix_suggere_min: number;
    prix_suggere_max: number;
    prix_suggere_median: number;
    devise: string;
    facteurs_influence: string[];
    comparaison_marche: string;
    confidence: number;
}

export interface BookExchange {
    id: number;
    livre_offert_id: number;
    livre_souhaite_id: number;
    initiateur_id: number;
    participant_id: number;
    exchange_type: string;
    prix_negocie?: number;
    statut: string;
    created_at: string;
    updated_at: string;
}

export interface BookAnalytics {
    id: number;
    user_id?: number;
    livre_id?: number;
    nombre_vues: number;
    nombre_contacts: number;
    nombre_echanges_completes: number;
    score_popularite: number;
    periode_debut: string;
    periode_fin: string;
}

// API Functions
export const bourseLivreApi = {
    // Recommandations IA
    getRecommendations: async (request: BookRecommendationRequest): Promise<BookRecommendationResponse> => {
        const response = await apiPost<BookRecommendationResponse>(
            '/api/bourse-livre/ai/recommendations',
            request
        );
        const r = response.data as any;
        return r?.recommendation || r;
    },

    // Matching IA
    getMatching: async (request: BookMatchingRequest): Promise<BookMatchingResponse> => {
        const response = await apiPost<BookMatchingResponse>(
            '/api/bourse-livre/ai/matching',
            request
        );
        const r = response.data as any;
        return r?.matching || r;
    },

    // Suggestions prix
    // ✅ FIX: URL corrigée /ai/price-suggestions (pas /price-suggestions)
    getPriceSuggestions: async (request: PriceSuggestionRequest): Promise<PriceSuggestionResponse> => {
        const params = new URLSearchParams();
        Object.entries(request).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });
        const response = await apiGet<PriceSuggestionResponse>(
            `/api/bourse-livre/ai/price-suggestions?${params.toString()}`
        );
        const r = response.data as any;
        return r?.suggestion || r;
    },

    // Mes échanges
    getMyExchanges: async (statut?: string): Promise<BookExchange[]> => {
        const params = statut ? `?statut=${statut}` : '';
        const response = await apiGet<{ exchanges: BookExchange[] }>(
            `/api/bourse-livre/my-exchanges${params}`
        );
        const r = response.data as any;
        return r?.exchanges || [];
    },

    // Analytics
    getAnalytics: async (livre_id?: number): Promise<BookAnalytics | BookAnalytics[]> => {
        const params = livre_id ? `?livre_id=${livre_id}` : '';
        const response = await apiGet<{ analytics: BookAnalytics | BookAnalytics[] }>(
            `/api/bourse-livre/analytics${params}`
        );
        const r = response.data as any;
        return r?.analytics || [];
    },
};


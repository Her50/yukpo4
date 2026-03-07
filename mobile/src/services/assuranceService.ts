/**
 * ✅ Service Assurance dédié
 * 
 * Endpoints backend :
 * - GET  /api/assurance/search              - Recherche dédiée
 * - POST /api/assurance/ai/quote            - Génération devis IA
 * - POST /api/assurance/ai/compare          - Comparaison produits IA
 * - POST /api/assurance/ai/recommendations  - Recommandations personnalisées IA
 * - POST /api/assurance/ai/estimate-premium - Estimation prime IA
 */

import { apiGet, apiPost } from './api';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface InsuranceSearchFilters {
    type_assurance?: string;
    compagnie?: string;
    ville?: string;
    quartier?: string;
    gps_lat?: number;
    gps_lon?: number;
    rayon_km?: number;
    prix_min?: number;
    prix_max?: number;
    limit?: number;
    offset?: number;
}

export interface InsuranceResult {
    id: number;
    titre: string;
    description?: string;
    type_assurance?: string;
    compagnie?: string;
    ville?: string;
    quartier?: string;
    adresse?: string;
    prix?: number;
    telephone?: string;
    prestataire?: string;
    distance_km?: number;
    couvertures?: string[];
    images?: string[];
}

export interface InsuranceProfile {
    age?: number;
    profession?: string;
    ville?: string;
    situation_familiale?: string;
    nombre_personnes?: number;
    budget_mensuel?: number;
    vehicule_type?: string;
    vehicule_valeur?: number;
    bien_immobilier_type?: string;
    bien_immobilier_valeur?: number;
}

export interface InsuranceQuote {
    type_assurance: string;
    produit: string;
    compagnie_suggeree: string;
    prime_mensuelle_estimee: number;
    prime_annuelle_estimee: number;
    couvertures_incluses: string[];
    franchises: { garantie: string; montant: string }[];
    avantages: string[];
    conditions: string[];
    score_adequation: number;
    justification: string;
}

export interface ComparedProduct {
    nom: string;
    compagnie: string;
    prime_annuelle: number;
    couvertures: string[];
    note_globale: number;
    points_forts: string[];
    points_faibles: string[];
}

export interface InsuranceComparison {
    produits: ComparedProduct[];
    recommandation: string;
    meilleur_rapport_qualite_prix: string;
    meilleure_couverture: string;
    criteres_comparaison: { critere: string; poids: number }[];
}

export interface InsuranceRecommendation {
    type_assurance: string;
    produit_recommande: string;
    compagnie: string;
    prime_estimee: number;
    score: number;
    raison: string;
    couvertures_cles: string[];
}

export interface PremiumEstimate {
    prime_mensuelle_min: number;
    prime_mensuelle_max: number;
    prime_mensuelle_moyenne: number;
    prime_annuelle_min: number;
    prime_annuelle_max: number;
    prime_annuelle_moyenne: number;
    facteurs_prix: string[];
    conseils_economie: string[];
    compagnies_recommandees: string[];
}

// ═══════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════

const assuranceService = {
    /**
     * Recherche dédiée de produits d'assurance
     */
    searchInsurance: async (filters: InsuranceSearchFilters): Promise<InsuranceResult[]> => {
        try {
            const params = new URLSearchParams();
            if (filters.type_assurance) params.append('type_assurance', filters.type_assurance);
            if (filters.compagnie) params.append('compagnie', filters.compagnie);
            if (filters.ville) params.append('ville', filters.ville);
            if (filters.quartier) params.append('quartier', filters.quartier);
            if (filters.gps_lat) params.append('gps_lat', filters.gps_lat.toString());
            if (filters.gps_lon) params.append('gps_lon', filters.gps_lon.toString());
            if (filters.rayon_km) params.append('rayon_km', filters.rayon_km.toString());
            if (filters.prix_min) params.append('prix_min', filters.prix_min.toString());
            if (filters.prix_max) params.append('prix_max', filters.prix_max.toString());
            if (filters.limit) params.append('limit', filters.limit.toString());
            if (filters.offset) params.append('offset', filters.offset.toString());

            const response = await apiGet(`/api/assurance/search?${params.toString()}`);
            const backendData = response?.data as any;
            return backendData?.results || [];
        } catch (error) {
            console.error('[assuranceService] searchInsurance error:', error);
            return [];
        }
    },

    /**
     * Génération de devis IA personnalisé
     */
    generateQuote: async (
        typeAssurance: string,
        profile?: InsuranceProfile,
        couverturesSouhaitees?: string[],
    ): Promise<InsuranceQuote | null> => {
        try {
            const response = await apiPost('/api/assurance/ai/quote', {
                type_assurance: typeAssurance,
                profile: profile || {},
                couvertures_souhaitees: couverturesSouhaitees || [],
            });
            const backendData = response?.data as any;
            return backendData?.quote || null;
        } catch (error) {
            console.error('[assuranceService] generateQuote error:', error);
            return null;
        }
    },

    /**
     * Comparaison de produits d'assurance avec IA
     */
    compareProducts: async (
        typeAssurance: string,
        produits: string[],
        profile?: InsuranceProfile,
    ): Promise<InsuranceComparison | null> => {
        try {
            const response = await apiPost('/api/assurance/ai/compare', {
                type_assurance: typeAssurance,
                produits,
                profile: profile || {},
            });
            const backendData = response?.data as any;
            return backendData?.comparison || null;
        } catch (error) {
            console.error('[assuranceService] compareProducts error:', error);
            return null;
        }
    },

    /**
     * Recommandations personnalisées IA
     */
    getRecommendations: async (
        profile?: InsuranceProfile,
        limit?: number,
    ): Promise<InsuranceRecommendation[]> => {
        try {
            const response = await apiPost('/api/assurance/ai/recommendations', {
                profile: profile || {},
                limit: limit || 5,
            });
            const backendData = response?.data as any;
            return backendData?.recommendations || [];
        } catch (error) {
            console.error('[assuranceService] getRecommendations error:', error);
            return [];
        }
    },

    /**
     * Estimation de prime d'assurance avec IA
     */
    estimatePremium: async (
        typeAssurance: string,
        produit: string,
        profile?: InsuranceProfile,
    ): Promise<PremiumEstimate | null> => {
        try {
            const response = await apiPost('/api/assurance/ai/estimate-premium', {
                type_assurance: typeAssurance,
                produit,
                profile: profile || {},
            });
            const backendData = response?.data as any;
            return backendData?.estimate || null;
        } catch (error) {
            console.error('[assuranceService] estimatePremium error:', error);
            return null;
        }
    },
};

export default assuranceService;

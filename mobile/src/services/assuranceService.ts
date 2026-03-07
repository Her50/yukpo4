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

import { apiGet, apiPost, apiPut } from './api';

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
// TYPES DIGITALISATION COMPLÈTE
// ═══════════════════════════════════════════════════════════════

export interface InsuranceProduct {
    id: number;
    service_id: number;
    nom_produit: string;
    type_assurance: string;
    sous_categorie: string;
    description?: string;
    compagnie?: string;
    prime_mensuelle?: string;
    prime_annuelle?: string;
    couverture_max?: string;
    franchise_montant?: string;
    duree_contrat_mois?: number;
    garanties?: string[];
    exclusions?: string[];
    avantages?: string[];
    options_supplementaires?: any;
    documents_requis?: string[];
    age_min?: number;
    age_max?: number;
    is_active: boolean;
    is_featured: boolean;
    souscriptions_count: number;
    note_moyenne?: string;
}

export interface InsurancePolicy {
    id: number;
    product_id: number;
    numero_police: string;
    nom_produit?: string;
    type_assurance?: string;
    sous_categorie?: string;
    compagnie?: string;
    client_nom: string;
    client_prenom?: string;
    client_telephone?: string;
    date_effet?: string;
    date_expiration?: string;
    prime_totale?: string;
    statut: string;
    garanties?: any[];
    couverture_max?: string;
    renouvellement_auto: boolean;
    created_at?: string;
}

export interface InsuranceClaim {
    id: number;
    policy_id: number;
    numero_sinistre: string;
    numero_police?: string;
    nom_produit?: string;
    type_assurance?: string;
    compagnie?: string;
    type_sinistre: string;
    date_sinistre?: string;
    description_sinistre?: string;
    lieu_sinistre?: string;
    statut: string;
    priorite: string;
    dommages_estimes?: string;
    montant_reclame?: string;
    montant_indemnise?: string;
    agent_traitant?: string;
    fraud_score?: string;
    ai_analysis?: any;
    historique_statuts?: any[];
    created_at?: string;
}

export interface DashboardStats {
    products: { total: number; actifs: number; total_souscriptions: number };
    policies: { total: number; actives: number; suspendues: number; expirees: number; a_renouveler: number; ca_total?: string };
    claims: { total: number; declares: number; en_instruction: number; en_expertise: number; approuves: number; indemnises: number; refuses: number; total_reclame?: string; total_indemnise?: string };
}

export interface CreateProductPayload {
    service_id: number;
    nom_produit: string;
    type_assurance: string;
    sous_categorie: string;
    description?: string;
    compagnie?: string;
    prime_mensuelle?: number;
    prime_trimestrielle?: number;
    prime_semestrielle?: number;
    prime_annuelle?: number;
    couverture_max?: number;
    franchise_montant?: number;
    franchise_pourcentage?: number;
    duree_contrat_mois?: number;
    age_min?: number;
    age_max?: number;
    garanties?: string[];
    exclusions?: string[];
    conditions_generales?: string;
    avantages?: string[];
    options_supplementaires?: any;
    documents_requis?: string[];
    delai_carence_jours?: number;
}

export interface CreatePolicyPayload {
    product_id: number;
    client_nom: string;
    client_prenom?: string;
    client_telephone?: string;
    client_email?: string;
    client_adresse?: string;
    client_date_naissance?: string;
    client_profession?: string;
    client_user_id?: number;
    beneficiaires?: any;
    date_effet: string;
    date_expiration: string;
    prime_totale: number;
    frequence_paiement?: string;
    garanties_souscrites?: any;
    options_souscrites?: any;
    conditions_particulieres?: string;
    objet_assure?: any;
    renouvellement_auto?: boolean;
}

export interface CreateClaimPayload {
    policy_id: number;
    type_sinistre: string;
    date_sinistre: string;
    lieu_sinistre?: string;
    gps_sinistre?: string;
    description_sinistre: string;
    circonstances?: string;
    temoins?: any;
    dommages_estimes?: number;
    montant_reclame?: number;
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

    // ═══════════════════════════════════════════════════════════════
    // CRUD PRODUITS (PARTENAIRE)
    // ═══════════════════════════════════════════════════════════════

    createProduct: async (data: CreateProductPayload): Promise<{ success: boolean; product_id?: number }> => {
        try {
            const response = await apiPost('/api/assurance/products', data);
            const r = response?.data as any;
            return { success: r?.success || false, product_id: r?.product_id };
        } catch (error) {
            console.error('[assuranceService] createProduct error:', error);
            return { success: false };
        }
    },

    listProducts: async (): Promise<InsuranceProduct[]> => {
        try {
            const response = await apiGet('/api/assurance/products');
            const r = response?.data as any;
            return r?.products || [];
        } catch (error) {
            console.error('[assuranceService] listProducts error:', error);
            return [];
        }
    },

    updateProduct: async (id: number, data: CreateProductPayload): Promise<boolean> => {
        try {
            const response = await apiPut(`/api/assurance/products/${id}`, data);
            return (response?.data as any)?.success || false;
        } catch (error) {
            console.error('[assuranceService] updateProduct error:', error);
            return false;
        }
    },

    toggleProduct: async (id: number): Promise<{ success: boolean; is_active?: boolean }> => {
        try {
            const response = await apiPost(`/api/assurance/products/${id}/toggle`, {});
            const r = response?.data as any;
            return { success: r?.success || false, is_active: r?.is_active };
        } catch (error) {
            console.error('[assuranceService] toggleProduct error:', error);
            return { success: false };
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // POLICES / CONTRATS
    // ═══════════════════════════════════════════════════════════════

    createPolicy: async (data: CreatePolicyPayload): Promise<{ success: boolean; policy_id?: number; numero_police?: string }> => {
        try {
            const response = await apiPost('/api/assurance/policies', data);
            const r = response?.data as any;
            return { success: r?.success || false, policy_id: r?.policy_id, numero_police: r?.numero_police };
        } catch (error) {
            console.error('[assuranceService] createPolicy error:', error);
            return { success: false };
        }
    },

    listPolicies: async (statut?: string): Promise<InsurancePolicy[]> => {
        try {
            const url = statut ? `/api/assurance/policies?statut=${statut}` : '/api/assurance/policies';
            const response = await apiGet(url);
            const r = response?.data as any;
            return r?.policies || [];
        } catch (error) {
            console.error('[assuranceService] listPolicies error:', error);
            return [];
        }
    },

    getClientPolicies: async (): Promise<InsurancePolicy[]> => {
        try {
            const response = await apiGet('/api/assurance/policies/client');
            const r = response?.data as any;
            return r?.policies || [];
        } catch (error) {
            console.error('[assuranceService] getClientPolicies error:', error);
            return [];
        }
    },

    updatePolicyStatus: async (id: number, statut: string, motif?: string): Promise<boolean> => {
        try {
            const response = await apiPut(`/api/assurance/policies/${id}/status`, { statut, motif });
            return (response?.data as any)?.success || false;
        } catch (error) {
            console.error('[assuranceService] updatePolicyStatus error:', error);
            return false;
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // SINISTRES
    // ═══════════════════════════════════════════════════════════════

    createClaim: async (data: CreateClaimPayload): Promise<{ success: boolean; claim_id?: number; numero_sinistre?: string }> => {
        try {
            const response = await apiPost('/api/assurance/claims', data);
            const r = response?.data as any;
            return { success: r?.success || false, claim_id: r?.claim_id, numero_sinistre: r?.numero_sinistre };
        } catch (error) {
            console.error('[assuranceService] createClaim error:', error);
            return { success: false };
        }
    },

    listClaims: async (statut?: string): Promise<InsuranceClaim[]> => {
        try {
            const url = statut ? `/api/assurance/claims?statut=${statut}` : '/api/assurance/claims';
            const response = await apiGet(url);
            const r = response?.data as any;
            return r?.claims || [];
        } catch (error) {
            console.error('[assuranceService] listClaims error:', error);
            return [];
        }
    },

    getClientClaims: async (): Promise<InsuranceClaim[]> => {
        try {
            const response = await apiGet('/api/assurance/claims/client');
            const r = response?.data as any;
            return r?.claims || [];
        } catch (error) {
            console.error('[assuranceService] getClientClaims error:', error);
            return [];
        }
    },

    updateClaimStatus: async (id: number, statut: string, extras?: { note?: string; montant_indemnise?: number; motif_refus?: string; agent_traitant?: string }): Promise<boolean> => {
        try {
            const response = await apiPut(`/api/assurance/claims/${id}/status`, { statut, ...extras });
            return (response?.data as any)?.success || false;
        } catch (error) {
            console.error('[assuranceService] updateClaimStatus error:', error);
            return false;
        }
    },

    aiAnalyzeClaim: async (claimId: number): Promise<any> => {
        try {
            const response = await apiPost(`/api/assurance/claims/${claimId}/ai-analyze`, {});
            const r = response?.data as any;
            return r?.analysis || null;
        } catch (error) {
            console.error('[assuranceService] aiAnalyzeClaim error:', error);
            return null;
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // DASHBOARD STATS
    // ═══════════════════════════════════════════════════════════════

    getDashboardStats: async (): Promise<DashboardStats | null> => {
        try {
            const response = await apiGet('/api/assurance/dashboard/stats');
            const r = response?.data as any;
            if (r?.success) {
                return { products: r.products, policies: r.policies, claims: r.claims };
            }
            return null;
        } catch (error) {
            console.error('[assuranceService] getDashboardStats error:', error);
            return null;
        }
    },
};

export default assuranceService;

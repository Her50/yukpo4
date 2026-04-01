// ✅ Service API pour Produits de Pharmacie (Médicaments)
import { apiGet, apiPost } from './api';

// Types pour les produits de pharmacie
export interface PharmacyProduct {
    id: number;
    pharmacy_service_id: number;
    nom_produit: string;
    description?: string;
    prix: number;
    stock: number;
    unite: string;
    code_barre?: string;
    categorie?: string;
    pharmacy_name?: string;
    pharmacy_ville?: string;
    pharmacy_quartier?: string;
    pharmacy_gps?: string;
    pharmacy_telephone?: string;
    pharmacy_whatsapp?: string;
    distance_km?: number;
    created_at?: string;
    updated_at?: string;
}

export interface ProductSearchFilters {
    query?: string;
    categorie?: string;
    lat?: number;
    lng?: number;
    radius_km?: number;
    min_price?: number;
    max_price?: number;
    only_available?: boolean;
    limit?: number;
}

export interface NearbyMedicineFilters {
    q: string;
    lat?: number;
    lng?: number;
    radius_km?: number;
    quantity?: number;
    max_price?: number;
    on_duty_only?: boolean;
    limit?: number;
}

export interface NearbyMedicineItem extends PharmacyProduct {
    pharmacy_id?: number;
    pharmacy_nom?: string;
    pharmacy_adresse?: string;
    is_on_duty_now?: boolean;
    can_fulfill_quantity?: boolean;
}

export interface BudgetComparison {
    total_budget: number;
    pharmacies: Array<{
        pharmacy_id: number;
        pharmacy_name: string;
        total_price: number;
        items: Array<{
            product_id: number;
            product_name: string;
            quantity: number;
            unit_price: number;
            total_price: number;
        }>;
    }>;
    cheapest_pharmacy_id: number;
    savings: number;
}

export const pharmacyProductService = {
    // ✅ Recherche de produits/médicaments
    searchProducts: async (filters: ProductSearchFilters) => {
        const response = await apiGet<{ success: boolean; products: PharmacyProduct[] }>(
            '/api/pharmacies/products/search',
            { params: filters }
        );
        return response;
    },

    searchNearbyMedicines: async (filters: NearbyMedicineFilters) => {
        const response = await apiGet<{ success: boolean; items: NearbyMedicineItem[] }>(
            '/api/medicines/nearby',
            { params: filters }
        );
        return response;
    },

    // ✅ Produits d'une pharmacie spécifique
    getPharmacyProducts: async (pharmacyId: number) => {
        const response = await apiGet<{ success: boolean; products: PharmacyProduct[] }>(
            `/api/pharmacies/${pharmacyId}/products`
        );
        return response;
    },

    // ✅ Calculer budget comparatif
    calculateBudget: async (
        items: Array<{ product_id: number; quantity: number }>,
        lat?: number,
        lng?: number
    ) => {
        const body: any = { items };
        if (lat !== undefined) body.lat = lat;
        if (lng !== undefined) body.lng = lng;

        const response = await apiPost<{ success: boolean; comparison: BudgetComparison }>(
            '/api/pharmacies/products/budget',
            body
        );
        return response;
    },
};


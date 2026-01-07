// ✅ Service API pour Supermarchés avec produits externes
import { apiGet, apiPost } from './api';

// Types pour les supermarchés
export interface Supermarket {
    id: string | number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distance_km?: number;
    phone?: string;
    website?: string;
    logo_url?: string;
    external_api_id?: string; // ID dans l'API externe
    external_api_type?: 'carrefour' | 'casino' | 'auchan' | 'leclerc' | 'intermarche' | 'monoprix' | 'franprix' | 'other';
}

// Types pour les produits
export interface SupermarketProduct {
    id: string;
    name: string;
    description?: string;
    price: number;
    original_price?: number; // Prix avant promotion
    currency: string;
    image_url?: string;
    category: string;
    brand?: string;
    unit?: string; // kg, L, pièce, etc.
    quantity?: number;
    is_promotion: boolean;
    promotion_percentage?: number;
    promotion_end_date?: string;
    stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock';
    supermarket_id: string | number;
    supermarket_name: string;
    external_product_id?: string; // ID dans l'API externe
}

// Types pour la comparaison de prix
export interface PriceComparison {
    product_name: string;
    product_id?: string;
    category: string;
    supermarkets: Array<{
        supermarket_id: string | number;
        supermarket_name: string;
        product: SupermarketProduct;
        distance_km?: number;
    }>;
    cheapest: {
        supermarket_id: string | number;
        supermarket_name: string;
        price: number;
    };
    average_price: number;
    price_range: {
        min: number;
        max: number;
    };
}

// Types pour les promotions
export interface SupermarketPromotion {
    id: string;
    title: string;
    description?: string;
    discount_percentage?: number;
    discount_amount?: number;
    start_date: string;
    end_date: string;
    products: SupermarketProduct[];
    supermarket_id: string | number;
    supermarket_name: string;
    image_url?: string;
    category?: string;
}

export interface SearchProductsFilters {
    supermarket_id?: string | number;
    query?: string;
    category?: string;
    min_price?: number;
    max_price?: number;
    on_promotion?: boolean;
    in_stock?: boolean;
    page?: number;
    limit?: number;
}

export const supermarketService = {
    // ✅ Liste des supermarchés à proximité
    listSupermarkets: async (latitude: number, longitude: number, radiusKm: number = 10) => {
        const response = await apiGet<{ supermarkets: Supermarket[]; total: number }>(
            '/api/services/nearby',
            {
                params: {
                    latitude,
                    longitude,
                    radius: radiusKm * 1000,
                    limit: 50,
                    type: 'supermarche',
                },
            }
        );
        // Filtrer et formater les supermarchés
        const keywords = ['supermarche', 'supermarket', 'carrefour', 'casino', 'super u', 'auchan', 'leclerc', 'intermarche', 'monoprix', 'franprix', 'magasin', 'epicerie', 'hypermarché'];
        const services = (response.data as any)?.services || [];
        const supermarkets = services
            .filter((service: any) => {
                const category = (service.category || '').toLowerCase();
                const name = (service.name || '').toLowerCase();
                const description = (service.description || '').toLowerCase();
                return keywords.some(keyword =>
                    category.includes(keyword) || name.includes(keyword) || description.includes(keyword)
                );
            })
            .map((service: any) => ({
                id: service.id,
                name: service.name,
                address: service.address || 'Adresse non disponible',
                latitude: service.latitude || 0,
                longitude: service.longitude || 0,
                distance_km: service.distance ? Math.round(service.distance / 1000 * 10) / 10 : undefined,
                phone: service.phone,
                website: service.website,
            }));
        return { supermarkets, total: supermarkets.length };
    },

    // ✅ Récupérer les produits d'un supermarché (via API externe)
    getSupermarketProducts: async (supermarketId: string | number, filters?: SearchProductsFilters) => {
        const response = await apiGet<{ success: boolean; products: SupermarketProduct[]; total: number }>(
            `/api/supermarkets/${supermarketId}/products`,
            {
                params: {
                    ...filters,
                    page: filters?.page || 1,
                    limit: filters?.limit || 50,
                },
            }
        );
        return response;
    },

    // ✅ Rechercher un produit dans tous les supermarchés
    searchProduct: async (query: string, latitude?: number, longitude?: number, radiusKm?: number) => {
        const response = await apiGet<{ success: boolean; products: SupermarketProduct[]; total: number }>(
            '/api/supermarkets/products/search',
            {
                params: {
                    query,
                    lat: latitude,
                    lng: longitude,
                    radius_km: radiusKm,
                },
            }
        );
        return response;
    },

    // ✅ Comparer les prix d'un produit entre supermarchés
    compareProductPrices: async (productName: string, productId?: string, latitude?: number, longitude?: number, radiusKm?: number) => {
        const response = await apiPost<{ success: boolean; comparison: PriceComparison }>(
            '/api/supermarkets/compare-prices',
            {
                product_name: productName,
                product_id: productId,
                lat: latitude,
                lng: longitude,
                radius_km: radiusKm,
            }
        );
        return response;
    },

    // ✅ Récupérer les promotions d'un supermarché
    getSupermarketPromotions: async (supermarketId: string | number, activeOnly: boolean = true) => {
        const response = await apiGet<{ success: boolean; promotions: SupermarketPromotion[]; total: number }>(
            `/api/supermarkets/${supermarketId}/promotions`,
            {
                params: {
                    active_only: activeOnly,
                },
            }
        );
        return response;
    },

    // ✅ Récupérer toutes les promotions à proximité
    getNearbyPromotions: async (latitude: number, longitude: number, radiusKm: number = 10) => {
        const response = await apiGet<{ success: boolean; promotions: SupermarketPromotion[]; total: number }>(
            '/api/supermarkets/promotions/nearby',
            {
                params: {
                    lat: latitude,
                    lng: longitude,
                    radius_km: radiusKm,
                },
            }
        );
        return response;
    },

    // ✅ Récupérer les catégories de produits d'un supermarché
    getSupermarketCategories: async (supermarketId: string | number) => {
        const response = await apiGet<{ success: boolean; categories: string[] }>(
            `/api/supermarkets/${supermarketId}/categories`
        );
        return response;
    },

    // ✅ NOUVEAU: Récupérer les produits tendances
    getTrendingProducts: async (latitude?: number, longitude?: number, radiusKm?: number) => {
        const response = await apiGet<{ success: boolean; products: SupermarketProduct[]; total: number }>(
            '/api/supermarkets/products/trending',
            {
                params: {
                    lat: latitude,
                    lng: longitude,
                    radius_km: radiusKm,
                },
            }
        );
        return response;
    },
};


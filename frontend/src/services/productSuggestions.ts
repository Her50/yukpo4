import { apiGet } from '@/services/apiService';

export interface PopularProductSuggestion {
    product_vector: string[];
    product_labels: string[];
    usage_count: number;
    prix_moyen?: number | null;
    has_variant: boolean;
    variant_dimension?: string | null;
    variant_value?: string | null;
    is_trending: boolean;
}

interface PopularProductsResponse {
    success: boolean;
    data: PopularProductSuggestion[];
    count: number;
    message?: string;
}

const normalizeSuggestion = (suggestion: PopularProductSuggestion) => ({
    ...suggestion,
    product_vector: suggestion.product_vector ?? [],
    product_labels: suggestion.product_labels ?? [],
});

export const fetchPopularProducts = async (
    search?: string,
    signal?: AbortSignal,
    limit = 8,
): Promise<PopularProductSuggestion[]> => {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    if (search && search.trim().length > 0) {
        params.set('search', search.trim());
    }

    const response = await apiGet(`/api/products/popular?${params.toString()}`, {
        isAuthenticated: true,
        signal,
    });

    const payload = (await response.json()) as PopularProductsResponse;

    if (!payload.success) {
        throw new Error(payload.message ?? 'Impossible de récupérer les produits populaires');
    }

    return (payload.data ?? []).map(normalizeSuggestion);
};


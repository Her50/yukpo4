// ✅ NOUVEAU: Service frontend pour bibliothèque d'effets vidéo (50+)

import { apiCall } from './api';

export interface Effect {
    id: number;
    name: string;
    category: 'transitions' | 'visual_effects' | 'animations' | 'special';
    description: string;
    ffmpeg_filter: string;
    parameters: Record<string, any>;
    tags: string[];
    is_premium: boolean;
    popularity_score: number;
    created_at: string;
    updated_at: string;
}

export interface EffectSearchParams {
    category?: string;
    tags?: string[];
    search_query?: string;
    is_premium?: boolean;
    limit?: number;
    offset?: number;
}

export interface EffectListResponse {
    effects: Effect[];
    total: number;
    limit: number;
    offset: number;
}

export interface EffectParameter {
    name: string;
    type: 'float' | 'int' | 'bool' | 'string' | 'color';
    min?: number;
    max?: number;
    default: any;
    description?: string;
}

export const effectLibraryService = {
    /**
     * Liste tous les effets avec filtres optionnels
     */
    async listEffects(params?: EffectSearchParams): Promise<EffectListResponse> {
        const queryParams = new URLSearchParams();

        if (params?.category) queryParams.append('category', params.category);
        if (params?.tags && params.tags.length > 0) queryParams.append('tags', params.tags.join(','));
        if (params?.search_query) queryParams.append('q', params.search_query);
        if (params?.is_premium !== undefined) queryParams.append('premium', String(params.is_premium));
        if (params?.limit) queryParams.append('limit', String(params.limit));
        if (params?.offset) queryParams.append('offset', String(params.offset));

        const queryString = queryParams.toString();
        const url = `/api/effects${queryString ? `?${queryString}` : ''}`;

        const response = await apiCall<EffectListResponse>(url);
        return response;
    },

    /**
     * Récupère un effet par son nom
     */
    async getEffectByName(name: string): Promise<Effect | null> {
        try {
            const response = await apiCall<Effect>(`/api/effects/${encodeURIComponent(name)}`);
            return response;
        } catch (error) {
            console.error(`[EffectLibrary] Erreur récupération effet ${name}:`, error);
            return null;
        }
    },

    /**
     * Récupère les effets par catégorie
     */
    async getEffectsByCategory(category: string): Promise<Effect[]> {
        try {
            const response = await apiCall<Effect[]>(`/api/effects/category/${encodeURIComponent(category)}`);
            return (response as any) || [];
        } catch (error) {
            console.error(`[EffectLibrary] Erreur récupération effets catégorie ${category}:`, error);
            return [];
        }
    },

    /**
     * Recherche d'effets par tags
     */
    async searchEffectsByTags(tags: string[]): Promise<Effect[]> {
        if (tags.length === 0) return [];

        try {
            const response = await effectLibraryService.listEffects({ tags });
            return response.effects || [];
        } catch (error) {
            console.error('[EffectLibrary] Erreur recherche par tags:', error);
            return [];
        }
    },

    /**
     * Recherche d'effets par query textuelle
     */
    async searchEffects(query: string, category?: string): Promise<Effect[]> {
        try {
            const response = await effectLibraryService.listEffects({
                search_query: query,
                category,
                limit: 50,
            });
            return response.effects || [];
        } catch (error) {
            console.error('[EffectLibrary] Erreur recherche:', error);
            return [];
        }
    },
};



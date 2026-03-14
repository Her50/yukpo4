// @ts-nocheck
// ✅ NOUVEAU: Service frontend pour bibliothèque de templates vidéo par industrie (50+)

import { apiCall } from './api';

export interface VideoTemplate {
    id: number;
    name: string;
    industry: 'ecommerce' | 'services' | 'creators' | 'business' | 'social_media';
    subcategory?: string;
    description: string;
    timeline: any; // JSON VideoTimeline
    effects: any[]; // JSON array
    transitions: any[]; // JSON array
    style: {
        primary_color?: string;
        secondary_color?: string;
        font_family?: string;
        font_size?: number;
        text_color?: string;
        background_color?: string;
    };
    duration: number;
    format: '16:9' | '9:16' | '1:1' | '4:5';
    tags: string[];
    thumbnail_url?: string;
    preview_url?: string;
    is_premium: boolean;
    popularity_score: number;
    usage_count: number;
    created_at: string;
    updated_at: string;
}

export interface TemplateSearchParams {
    industry?: string;
    subcategory?: string;
    search_query?: string;
    is_premium?: boolean;
    limit?: number;
    offset?: number;
}

export interface TemplateListResponse {
    templates: VideoTemplate[];
    total: number;
    limit: number;
    offset: number;
}

export const templateService = {
    /**
     * Liste tous les templates avec filtres optionnels
     */
    async listTemplates(params?: TemplateSearchParams): Promise<TemplateListResponse> {
        const queryParams = new URLSearchParams();

        if (params?.industry) queryParams.append('industry', params.industry);
        if (params?.subcategory) queryParams.append('subcategory', params.subcategory);
        if (params?.search_query) queryParams.append('q', params.search_query);
        if (params?.is_premium !== undefined) queryParams.append('premium', String(params.is_premium));
        if (params?.limit) queryParams.append('limit', String(params.limit));
        if (params?.offset) queryParams.append('offset', String(params.offset));

        const queryString = queryParams.toString();
        const url = `/api/templates${queryString ? `?${queryString}` : ''}`;

        const response = await apiCall<TemplateListResponse>(url);
        return response;
    },

    /**
     * Récupère un template par son nom
     */
    async getTemplateByName(name: string): Promise<VideoTemplate | null> {
        try {
            const response = await apiCall<{ template: VideoTemplate }>(`/api/templates/${encodeURIComponent(name)}`);
            return response.template || null;
        } catch (error) {
            console.error(`[TemplateService] Erreur récupération template ${name}:`, error);
            return null;
        }
    },

    /**
     * Récupère les templates par industrie
     */
    async getTemplatesByIndustry(industry: string): Promise<VideoTemplate[]> {
        try {
            const response = await apiCall<{ templates: VideoTemplate[] }>(`/api/templates/industry/${encodeURIComponent(industry)}`);
            return response.templates || [];
        } catch (error) {
            console.error(`[TemplateService] Erreur récupération templates industrie ${industry}:`, error);
            return [];
        }
    },

    /**
     * Recherche de templates par query textuelle
     */
    async searchTemplates(query: string, industry?: string): Promise<VideoTemplate[]> {
        try {
            const response = await templateService.listTemplates({
                search_query: query,
                industry,
                limit: 50,
            });
            return response.templates || [];
        } catch (error) {
            console.error('[TemplateService] Erreur recherche:', error);
            return [];
        }
    },
};


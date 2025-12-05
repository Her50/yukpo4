// ✅ NOUVEAU: Service de génération de previews d'effets

import { iaApi } from './api';

export interface EffectPreviewRequest {
    effect_name: string;
    sample_media_url: string;
    duration?: number;
    quality?: 'low' | 'medium' | 'high';
}

export interface EffectPreviewResponse {
    success: boolean;
    preview_url: string;
    effect_name: string;
    description: string;
    thumbnail_url?: string;
    processing_time_ms: number;
}

export const effectPreviewService = {
    /**
     * Génère un preview d'effet appliqué sur un média sample
     */
    async generatePreview(request: EffectPreviewRequest): Promise<EffectPreviewResponse> {
        const response = await iaApi.generateEffectPreview(request);

        if (!response.success) {
            throw new Error(response.error || 'Effect preview generation failed');
        }

        return response.data as EffectPreviewResponse;
    },
};


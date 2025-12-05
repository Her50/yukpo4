// ✅ NOUVEAU: Service de génération de preview rapide

import { VideoTimeline } from '../types/VideoGeneration';
import { iaApi } from './api';

export interface QuickPreviewRequest {
    timeline: VideoTimeline;
    quality?: 'low' | 'medium';
    max_duration?: number;
}

export interface QuickPreviewResponse {
    success: boolean;
    preview_url: string;
    preview_duration: number;
    quality: string;
    processing_time_ms: number;
    thumbnail_url?: string;
}

export const quickPreviewService = {
    /**
     * Génère un preview rapide (low quality) de la timeline
     */
    async generatePreview(request: QuickPreviewRequest): Promise<QuickPreviewResponse> {
        const response = await iaApi.generateQuickPreview(request);

        if (!response.success) {
            throw new Error(response.error || 'Quick preview generation failed');
        }

        return response.data as QuickPreviewResponse;
    },
};


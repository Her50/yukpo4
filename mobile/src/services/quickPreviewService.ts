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
    error?: string;
}

export const quickPreviewService = {
    /**
     * Génère un preview rapide (low quality) de la timeline
     */
    async generatePreview(request: QuickPreviewRequest): Promise<QuickPreviewResponse> {
        try {
            console.log('[quickPreviewService] \uD83D\uDCE4 Génération preview:', {
                scenesCount: request.timeline?.scenes?.length || 0,
                quality: request.quality || 'low',
                maxDuration: request.max_duration || 10.0,
            });

            const response = await iaApi.generateQuickPreview(request);

            console.log('[quickPreviewService] \uD83D\uDCE5 Réponse:', {
                success: response.success,
                hasData: !!response.data,
                error: response.error,
                message: response.message,
            });

            if (!response.success) {
                // ✅ CORRIGÉ: Créer une erreur avec plus de détails
                const error = new Error(response.error || response.message || 'Quick preview generation failed') as any;
                error.response = response;
                error.status = response.status;
                throw error;
            }

            return response.data as QuickPreviewResponse;
        } catch (error: any) {
            // ✅ CORRIGÉ: Logger l'erreur avec plus de détails
            console.error('[quickPreviewService] ❌ Erreur génération preview:', {
                message: error?.message,
                response: error?.response,
                status: error?.status,
            });
            throw error;
        }
    },
};


// ✅ NOUVEAU: Service de color grading automatique

import { iaApi } from './api';

export interface ColorGradingRequest {
    media_url: string;
    media_id?: number;
    style_preset?: 'cinematic' | 'vibrant' | 'moody' | 'warm' | 'cool';
    target_mood?: string;
    intensity?: number;
    maintain_skin_tones?: boolean;
}

export interface ColorAdjustments {
    exposure: number;
    contrast: number;
    saturation: number;
    highlights: number;
    shadows: number;
    temperature: number;
    tint: number;
    vibrance: number;
}

export interface ColorGradingResponse {
    success: boolean;
    graded_media_url: string;
    applied_preset: string;
    adjustments: ColorAdjustments;
    before_after_comparison?: string;
}

export const colorGradingService = {
    /**
     * Applique un color grading automatique à un média
     */
    async applyGrading(request: ColorGradingRequest): Promise<ColorGradingResponse> {
        const response = await iaApi.colorGradeMedia(request);

        if (!response.success) {
            throw new Error(response.error || 'Color grading failed');
        }

        return response.data as ColorGradingResponse;
    },
};


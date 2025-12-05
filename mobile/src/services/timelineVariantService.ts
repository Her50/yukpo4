// ✅ NOUVEAU: Service de génération de variantes de timeline

import { VideoTimeline } from '../types/VideoGeneration';
import { iaApi } from './api';

export interface TimelineVariantRequest {
    brief: {
        script_outline: string[];
        headline?: string;
        call_to_action?: string;
    };
    style: {
        effects: string[];
        transitions: string[];
        color_palette?: string;
    };
    available_media: Array<{
        id: string;
        url?: string;
        media_type: string;
    }>;
    duration_seconds: number;
    voiceover_script?: string;
    music_track_id?: string;
    lang?: string;
    variant_count?: number;
    variant_styles?: string[];
}

export interface TimelineVariant {
    variant_id: string;
    variant_name: string;
    variant_description: string;
    timeline: VideoTimeline;
    style_characteristics: {
        pacing: string;
        transition_style: string;
        effect_intensity: number;
        color_vibrancy: number;
    };
}

export interface TimelineVariantResponse {
    success: boolean;
    variants: TimelineVariant[];
    total_generation_time_ms: number;
}

export const timelineVariantService = {
    /**
     * Génère plusieurs variantes de timeline avec différents styles
     */
    async generateVariants(request: TimelineVariantRequest): Promise<TimelineVariantResponse> {
        const response = await iaApi.generateTimelineVariants(request);

        if (!response.success) {
            throw new Error(response.error || 'Timeline variant generation failed');
        }

        return response.data as TimelineVariantResponse;
    },
};


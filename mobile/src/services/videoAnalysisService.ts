// ✅ NOUVEAU: Service d'analyse vidéo pour auto-cut intelligent

import { iaApi } from './api';

export interface AutoCutRequest {
    video_url: string;
    video_id?: number;
    min_scene_duration?: number;
    max_scene_duration?: number;
    silence_threshold?: number;
    detect_highlights?: boolean;
    target_duration?: number;
}

export interface SceneCut {
    start_time: number;
    end_time: number;
    duration: number;
    confidence: number;
    scene_type: string;
    thumbnail_url?: string;
    audio_level: number;
    motion_score: number;
}

export interface Highlight {
    start_time: number;
    end_time: number;
    score: number;
    reason: string;
}

export interface AutoCutResponse {
    success: boolean;
    scenes: SceneCut[];
    highlights: Highlight[];
    total_duration: number;
    original_duration: number;
    silence_removed: number;
}

export const videoAnalysisService = {
    /**
     * Détecte automatiquement les scènes dans une vidéo
     */
    async autoCut(request: AutoCutRequest): Promise<AutoCutResponse> {
        const response = await iaApi.autoCutVideo(request);

        if (!response.success) {
            throw new Error(response.error || 'Auto-cut failed');
        }

        return response.data as AutoCutResponse;
    },
};


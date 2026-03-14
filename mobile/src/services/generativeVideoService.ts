// @ts-nocheck
// ✅ NOUVEAU Phase 3.1: Service frontend pour génération vidéo IA complète

import { apiCall } from './api';

export interface GenerateVideoRequest {
    description: string;
    duration_seconds?: number;
    style?: string;
    mood?: string;
    aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:5' | '21:9';
    provider?: 'runway' | 'pika' | 'sora' | 'stable_video_diffusion';
    music_style?: string;
}

export interface StoryboardScene {
    scene_number: number;
    description: string;
    duration_seconds: number;
    visual_style?: string;
    camera_movement?: string;
    mood?: string;
    prompt: string;
}

export interface Storyboard {
    total_duration: number;
    scenes: StoryboardScene[];
    style_guide?: any;
}

export interface GeneratedClip {
    scene_number: number;
    provider: string;
    video_url: string;
    local_path?: string;
    duration_seconds: number;
    thumbnail_url?: string;
    generated_at: string;
}

export type GenerativeJobStatus = 'queued' | 'generating_storyboard' | 'generating_clips' | 'assembling' | 'completed' | 'failed';

export interface GenerativeJobProgress {
    progress: number; // 0-100
    stage: GenerativeJobStatus;
    current_scene?: number;
    total_scenes?: number;
    message?: string;
    estimated_time_remaining?: number; // seconds
}

export interface GenerativeJob {
    job_id: string;
    user_id: number;
    request: GenerateVideoRequest;
    status: GenerativeJobStatus;
    progress: GenerativeJobProgress;
    storyboard?: Storyboard;
    generated_clips: GeneratedClip[];
    final_video_url?: string;
    final_timeline_id?: string;
    error?: string;
    created_at: string;
    updated_at: string;
    completed_at?: string;
}

export interface GenerateVideoResponse {
    success: boolean;
    job_id: string;
    message?: string;
    estimated_time_seconds?: number;
}

export const generativeVideoService = {
    /**
     * Démarre une génération vidéo complète depuis texte
     */
    async generateVideo(request: GenerateVideoRequest): Promise<GenerateVideoResponse> {
        const response = await apiCall<GenerateVideoResponse>('/api/generative/generate', {
            method: 'POST',
            body: JSON.stringify(request),
        });
        return response;
    },

    /**
     * Récupère le statut d'un job de génération
     */
    async getJobStatus(jobId: string): Promise<GenerativeJob> {
        const response = await apiCall<GenerativeJob>(
            `/api/generative/status/${encodeURIComponent(jobId)}`
        );
        return response;
    },

    /**
     * Annule un job de génération
     */
    async cancelJob(jobId: string): Promise<void> {
        await apiCall(`/api/generative/cancel/${encodeURIComponent(jobId)}`, {
            method: 'POST',
        });
    },
};


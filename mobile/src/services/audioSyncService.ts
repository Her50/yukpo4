// ✅ NOUVEAU: Service de synchronisation audio-vidéo

import { iaApi } from './api';

export interface AudioSyncRequest {
    video_url: string;
    audio_url?: string;
    music_track_id?: number;
    beat_detection?: boolean;
    auto_ducking?: boolean;
    sync_with_transitions?: boolean;
    target_bpm?: number;
    video_transitions?: number[];
}

export interface Beat {
    time: number;
    confidence: number;
    strength: number;
}

export interface SyncPoint {
    video_time: number;
    audio_time: number;
    beat_time: number;
    sync_type: string;
}

export interface AudioSyncResponse {
    success: boolean;
    synced_audio_url: string;
    beats: Beat[];
    bpm: number;
    sync_points: SyncPoint[];
    ducking_segments: Array<{
        start_time: number;
        end_time: number;
        duck_level: number;
        reason: string;
    }>;
}

export const audioSyncService = {
    /**
     * Synchronise l'audio avec la vidéo (beat detection, sync, ducking)
     */
    async syncAudio(request: AudioSyncRequest): Promise<AudioSyncResponse> {
        const response = await iaApi.syncAudioVideo(request);

        if (!response.success) {
            throw new Error(response.error || 'Audio sync failed');
        }

        return response.data as AudioSyncResponse;
    },
};


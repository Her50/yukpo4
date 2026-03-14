// @ts-nocheck
// ✅ NOUVEAU Phase 2.2: Service frontend pour bibliothèque audio étendue (Spotify/YouTube)

import { apiCall } from './api';

export interface AudioMetadata {
    track_id: string;
    title: string;
    artist: string;
    genre?: string;
    mood?: string;
    bpm?: number;
    duration_ms: number;
    preview_url?: string;
    thumbnail_url?: string;
    license: string;
    source: string; // "spotify", "youtube", "epidemic"
    popularity_score: number;
}

export interface AudioSearchParams {
    q?: string;
    genre?: string;
    mood?: string;
    bpm_min?: number;
    bpm_max?: number;
    license?: string;
    source?: 'spotify' | 'youtube' | 'all';
    limit?: number;
    offset?: number;
}

export interface AudioSearchResponse {
    success: boolean;
    tracks: AudioMetadata[];
    total: number;
    limit: number;
    offset: number;
}

export const extendedAudioLibraryService = {
    /**
     * Recherche audio unifiée (Spotify + YouTube)
     */
    async searchAudio(params: AudioSearchParams = {}): Promise<AudioSearchResponse> {
        const query = new URLSearchParams();
        if (params.q) query.append('q', params.q);
        if (params.genre) query.append('genre', params.genre);
        if (params.mood) query.append('mood', params.mood);
        if (params.bpm_min) query.append('bpm_min', String(params.bpm_min));
        if (params.bpm_max) query.append('bpm_max', String(params.bpm_max));
        if (params.license) query.append('license', params.license);
        if (params.source) query.append('source', params.source);
        if (params.limit) query.append('limit', String(params.limit));
        if (params.offset) query.append('offset', String(params.offset));

        const queryString = query.toString();
        const url = `/api/audio/search${queryString ? `?${queryString}` : ''}`;

        const response = await apiCall<AudioSearchResponse>(url);
        return response;
    },

    /**
     * Récupère les détails d'un track
     */
    async getTrack(trackId: string): Promise<AudioMetadata> {
        const response = await apiCall<{ success: boolean; track: AudioMetadata }>(
            `/api/audio/tracks/${encodeURIComponent(trackId)}`
        );
        return response.track;
    },

    /**
     * Liste des genres disponibles
     */
    async listGenres(): Promise<string[]> {
        const response = await apiCall<{ success: boolean; genres: string[] }>(
            '/api/audio/genres'
        );
        return response.genres;
    },

    /**
     * Liste des moods disponibles
     */
    async listMoods(): Promise<string[]> {
        const response = await apiCall<{ success: boolean; moods: string[] }>(
            '/api/audio/moods'
        );
        return response.moods;
    },
};


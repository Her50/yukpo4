// ✅ NOUVEAU: Service de suggestions audio contextuelles

import { iaApi } from './api';

export interface AudioSuggestionRequest {
    product_name: string;
    product_type?: string;
    tone?: string;
    channel?: string;
    duration_seconds?: number;
    count?: number;
}

export interface AudioSuggestion {
    track_id: string;
    title: string;
    genre: string;
    mood: string;
    bpm: number;
    preview_url: string;
    full_url?: string;
    relevance_score: number;
    description: string;
    duration_seconds?: number;
    license: string;
}

export interface AudioSuggestionResponse {
    success: boolean;
    suggestions: AudioSuggestion[];
    context_analysis: {
        recommended_genre: string;
        recommended_mood: string;
        recommended_bpm_range: [number, number];
        reasoning: string;
    };
}

export const audioSuggestionService = {
    /**
     * Génère des suggestions audio contextuelles basées sur le produit
     */
    async getSuggestions(request: AudioSuggestionRequest): Promise<AudioSuggestionResponse> {
        const response = await iaApi.getAudioSuggestions(request);

        if (!response.success) {
            throw new Error(response.error || 'Audio suggestion failed');
        }

        return response.data as AudioSuggestionResponse;
    },
};


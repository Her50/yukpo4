// ✅ NOUVEAU: Service de génération automatique de sous-titres

import { iaApi } from './api';

export interface AutoCaptionsRequest {
    video_url: string;
    audio_url?: string;
    lang?: string;
    style?: 'modern' | 'minimal' | 'bold' | 'elegant';
    position?: 'auto' | 'bottom' | 'top' | 'center';
    max_chars_per_line?: number;
    font_size?: number;
    background_opacity?: number;
}

export interface Subtitle {
    start_time: number;
    end_time: number;
    text: string;
    confidence: number;
    words?: Array<{
        word: string;
        start_time: number;
        end_time: number;
        confidence: number;
    }>;
}

export interface AutoCaptionsResponse {
    success: boolean;
    subtitles: Subtitle[];
    subtitle_file_url: string;
    styled_video_url?: string;
    confidence: number;
}

export const captionsService = {
    /**
     * Génère des sous-titres automatiques depuis l'audio d'une vidéo
     */
    async generateCaptions(request: AutoCaptionsRequest): Promise<AutoCaptionsResponse> {
        const response = await iaApi.generateAutoCaptions(request);

        if (!response.success) {
            throw new Error(response.error || 'Caption generation failed');
        }

        return response.data as AutoCaptionsResponse;
    },
};


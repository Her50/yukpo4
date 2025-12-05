// ✅ NOUVEAU Phase 2.3: Types pour paramètres d'export vidéo

export type ExportResolution = '720p' | '1080p' | '2K' | '4K' | '8K';

export type ExportFormat = 'mp4' | 'mov' | 'webm' | 'gif';

export type ExportCodec = 'h264' | 'h265' | 'prores' | 'vp9';

export type ExportQuality = 'low' | 'medium' | 'high' | 'ultra';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '21:9';

export interface ExportSettings {
    resolution: ExportResolution;
    format: ExportFormat;
    codec: ExportCodec;
    quality: ExportQuality;
    aspectRatio: AspectRatio;
    fps?: number; // FPS cible (défaut: 30)
    bitrate?: number; // Bitrate en kbps (optionnel, auto si non spécifié)
    watermark?: boolean; // Ajouter watermark Yukpo
    audioBitrate?: number; // Bitrate audio en kbps
}

export interface ExportProgress {
    progress: number; // 0-100
    stage: 'preparing' | 'rendering' | 'encoding' | 'uploading' | 'completed' | 'error';
    message?: string;
    estimatedTimeRemaining?: number; // en secondes
}

export interface ExportJob {
    jobId: string;
    settings: ExportSettings;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: ExportProgress;
    outputUrl?: string;
    error?: string;
    createdAt: number;
    completedAt?: number;
}

// Résolution to dimensions mapping
export const RESOLUTION_DIMENSIONS: Record<ExportResolution, { width: number; height: number }> = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '2K': { width: 2560, height: 1440 },
    '4K': { width: 3840, height: 2160 },
    '8K': { width: 7680, height: 4320 },
};

// Aspect ratio to dimensions (basé sur 1080p)
export const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 864, height: 1080 },
    '21:9': { width: 2520, height: 1080 },
};

// Codec recommendations per format
export const FORMAT_CODECS: Record<ExportFormat, ExportCodec[]> = {
    mp4: ['h264', 'h265'],
    mov: ['h264', 'prores'],
    webm: ['vp9'],
    gif: ['h264'], // GIF utilise h264 en transit puis conversion
};

// Bitrate recommendations per quality
export const QUALITY_BITRATES: Record<ExportQuality, { video: number; audio: number }> = {
    low: { video: 1000, audio: 96 },
    medium: { video: 5000, audio: 128 },
    high: { video: 10000, audio: 192 },
    ultra: { video: 20000, audio: 320 },
};


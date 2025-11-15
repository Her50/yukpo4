export type MusicMode = 'pulse' | 'lofi' | 'ambient' | 'cinematic' | 'none';

export interface VoiceProfileSummary {
    id: number;
    name: string;
    provider: string;
}

export interface CreateVoiceProfilePayload {
    name: string;
    provider?: string;
    description?: string;
    service_id?: number;
    sample_media_id?: number | null;
    metadata?: Record<string, unknown>;
}


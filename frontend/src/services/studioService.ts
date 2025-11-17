import type {
    StoryTemplateSpec,
    StudioDynamicAsset,
    StudioPreviewEvent,
    StudioPreviewMetrics,
    StudioPreviewResponse,
    StudioPublishResponse,
    StudioSession,
    StudioSessionAggregate,
    StudioTimelineClip
} from '../types/video';
import { apiDelete, apiGet, apiPost, apiPut } from './apiService';

const BASE = '/api/studio';

export interface CreateStudioSessionPayload {
    service_id?: number;
    brief?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    timeline_settings?: Record<string, unknown>;
    distribution_plan?: unknown[];
}

export interface UpdateStudioSessionPayload extends Partial<CreateStudioSessionPayload> {
    status?: string;
    ai_recommendations?: unknown;
    recommended_templates?: string[];
}

export interface TimelineClipInput {
    position: number;
    lane?: string | null;
    duration_seconds: number;
    payload: Record<string, unknown>;
}

export interface AttachAssetInput {
    asset_type: string;
    storage_key?: string;
    public_url?: string;
    metadata?: Record<string, unknown>;
}

export interface TemplateBusinessContextInput {
    service_category?: string;
    tone?: string;
    cta_label?: string;
    delivery_sla_minutes?: number;
    stock_level?: number;
    promotion_active?: boolean;
    price_label?: string;
    target_audience?: string;
}

export interface StoryboardRequest {
    script_outline: string[];
    product_name?: string;
    headline?: string;
    call_to_action?: string;
    style?: string;
    duration_seconds?: number;
    template_id?: string | null;
    business_context?: TemplateBusinessContextInput;
    ai_hints?: string[];
}

export interface StoryboardScene {
    index: number;
    sceneType: string;
    headline?: string;
    body?: string;
    durationHintSeconds: number;
    mediaHint?: string;
}

export interface Storyboard {
    templateId: string;
    totalDurationSeconds: number;
    scenes: StoryboardScene[];
    warnings: string[];
}

const parseJson = async <T>(response: Response): Promise<T> => {
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
};

export const studioService = {
    listSessions: async (): Promise<StudioSession[]> => {
        const res = await apiGet(`${BASE}/sessions`);
        return parseJson(res);
    },
    createSession: async (
        payload: CreateStudioSessionPayload
    ): Promise<StudioSessionAggregate> => {
        const res = await apiPost(`${BASE}/sessions`, payload);
        return parseJson(res);
    },
    getSession: async (sessionId: string): Promise<StudioSessionAggregate> => {
        const res = await apiGet(`${BASE}/sessions/${sessionId}`);
        return parseJson(res);
    },
    updateSession: async (
        sessionId: string,
        payload: UpdateStudioSessionPayload
    ): Promise<StudioSessionAggregate> => {
        const res = await apiPut(`${BASE}/sessions/${sessionId}`, payload);
        return parseJson(res);
    },
    deleteSession: async (sessionId: string): Promise<void> => {
        await apiDelete(`${BASE}/sessions/${sessionId}`);
    },
    saveTimeline: async (
        sessionId: string,
        clips: TimelineClipInput[]
    ): Promise<StudioTimelineClip[]> => {
        const res = await apiPut(`${BASE}/sessions/${sessionId}/timeline`, clips);
        return parseJson(res);
    },
    attachAsset: async (
        sessionId: string,
        payload: AttachAssetInput
    ): Promise<StudioDynamicAsset> => {
        const res = await apiPost(`${BASE}/sessions/${sessionId}/assets`, payload);
        return parseJson(res);
    },
    requestPreview: async (sessionId: string): Promise<StudioPreviewResponse> => {
        const res = await apiPost(`${BASE}/sessions/${sessionId}/preview`, {});
        return parseJson(res);
    },
    requestShortPreview: async (sessionId: string): Promise<StudioPreviewResponse> => {
        console.log('[studioService] requestShortPreview called with sessionId:', sessionId);

        const res = await apiPost(`${BASE}/sessions/${sessionId}/preview-short`, {});
        const json = await parseJson<StudioPreviewResponse>(res);

        console.log('[studioService] requestShortPreview response:', {
            success: !!json,
            hasPreviewUrl: !!json?.preview_url,
            previewUrl: json?.preview_url,
        });

        if (!json?.preview_url) {
            const errorMsg = 'Erreur lors de la génération de la prévisualisation : URL manquante';
            console.error('[studioService] Preview error details:', json);
            throw new Error(errorMsg);
        }

        return json;
    },
    publishSession: async (sessionId: string): Promise<StudioPublishResponse> => {
        const res = await apiPost(`${BASE}/sessions/${sessionId}/publish`, {});
        return parseJson(res);
    },
    listTemplates: async (): Promise<StoryTemplateSpec[]> => {
        const res = await apiGet(`${BASE}/templates`);
        return parseJson(res);
    },
    listPreviewEvents: async (sessionId: string): Promise<StudioPreviewEvent[]> => {
        const res = await apiGet(`${BASE}/sessions/${sessionId}/previews`);
        return parseJson(res);
    },
    getPreviewMetrics: async (sessionId: string): Promise<StudioPreviewMetrics> => {
        const res = await apiGet(`${BASE}/sessions/${sessionId}/preview-metrics`);
        return parseJson(res);
    },
    generateStoryboard: async (
        sessionId: string,
        payload: StoryboardRequest
    ): Promise<Storyboard> => {
        console.log('[studioService] generateStoryboard called with:', {
            sessionId,
            payload: JSON.stringify(payload, null, 2),
            url: `${BASE}/sessions/${sessionId}/storyboard`,
        });

        const res = await apiPost(`${BASE}/sessions/${sessionId}/storyboard`, payload);
        const json = await parseJson<{ storyboard: Storyboard }>(res);

        console.log('[studioService] generateStoryboard response:', {
            success: !!json,
            hasStoryboard: !!json?.storyboard,
            scenesCount: json?.storyboard?.scenes?.length || 0,
        });

        if (!json?.storyboard) {
            console.error('[studioService] Storyboard manquant dans la réponse:', json);
            throw new Error('Réponse storyboard invalide : structure de données manquante');
        }

        return json.storyboard;
    }
};


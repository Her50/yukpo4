import type {
    StoryTemplateSpec,
    StudioDynamicAsset,
    StudioPreviewEvent,
    StudioPreviewMetrics,
    StudioPreviewResponse,
    StudioPublishResponse,
    StudioSession,
    StudioSessionAggregate,
    StudioTimelineClip,
    TemplateRecommendationResponse,
} from '../types/VideoGeneration';
import { apiDelete, apiGet, apiPost, apiPut } from './api';

type ApiResponse<T> = {
    success?: boolean;
    data?: T | null;
    error?: string | null;
};

const BASE = '/api/studio';

const ensureSuccess = <T>(response: ApiResponse<T>, fallback?: T): T => {
    // ✅ AMÉLIORÉ: Gestion d'erreur plus détaillée avec codes HTTP
    if (response.success === false) {
        const errorMessage = response.error ?? 'Erreur API Studio';
        const error = new Error(errorMessage) as any;
        error.status = response.status;
        error.code = response.code;
        error.response = response;
        throw error;
    }
    if (response.data === undefined || response.data === null) {
        if (fallback !== undefined) {
            return fallback;
        }
        const errorMessage = response?.error ?? 'Réponse Studio vide';
        const error = new Error(errorMessage) as any;
        error.status = response.status;
        error.code = response.code;
        error.response = response;
        throw error;
    }
    return response.data;
};

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

export interface TemplateRecommendationRequest {
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

export const studioService = {
    async listSessions(): Promise<StudioSession[]> {
        const response = await apiGet<StudioSession[]>(`${BASE}/sessions`);
        return ensureSuccess(response, []);
    },

    async createSession(payload: CreateStudioSessionPayload): Promise<StudioSessionAggregate> {
        try {
            console.log('[studioService] createSession: Création session avec payload:', {
                service_id: payload.service_id,
                brief: payload.brief,
                metadata: payload.metadata,
            });
            const response = await apiPost<StudioSessionAggregate>(`${BASE}/sessions`, payload);
            console.log('[studioService] createSession: Réponse reçue:', {
                success: response.success,
                hasData: !!response.data,
                error: response.error,
                status: response.status,
            });
            return ensureSuccess(response);
        } catch (error: any) {
            console.error('[studioService] createSession: Erreur détaillée', {
                message: error?.message,
                status: error?.status,
                code: error?.code,
                response: error?.response,
                stack: error?.stack,
            });
            throw error;
        }
    },

    async getSession(sessionId: string): Promise<StudioSessionAggregate> {
        const response = await apiGet<StudioSessionAggregate>(`${BASE}/sessions/${sessionId}`);
        return ensureSuccess(response);
    },

    async updateSession(
        sessionId: string,
        payload: UpdateStudioSessionPayload,
    ): Promise<StudioSessionAggregate> {
        const response = await apiPut<StudioSessionAggregate>(`${BASE}/sessions/${sessionId}`, payload);
        return ensureSuccess(response);
    },

    async deleteSession(sessionId: string): Promise<void> {
        const response = await apiDelete<null>(`${BASE}/sessions/${sessionId}`);
        ensureSuccess(response, null);
    },

    async saveTimeline(sessionId: string, clips: TimelineClipInput[]): Promise<StudioTimelineClip[]> {
        const response = await apiPut<StudioTimelineClip[]>(
            `${BASE}/sessions/${sessionId}/timeline`,
            clips,
        );
        return ensureSuccess(response, []);
    },

    async attachAsset(
        sessionId: string,
        payload: AttachAssetInput,
    ): Promise<StudioDynamicAsset> {
        const response = await apiPost<StudioDynamicAsset>(
            `${BASE}/sessions/${sessionId}/assets`,
            payload,
        );
        return ensureSuccess(response);
    },

    async requestPreview(sessionId: string): Promise<StudioPreviewResponse> {
        const response = await apiPost<StudioPreviewResponse>(
            `${BASE}/sessions/${sessionId}/preview`,
            {},
        );
        return ensureSuccess(response);
    },

    async requestShortPreview(sessionId: string): Promise<StudioPreviewResponse> {
        console.log('[studioService] requestShortPreview called with sessionId:', sessionId);

        // ✅ CORRIGÉ 2025-12-24: Utiliser le bon endpoint (preview/short au lieu de preview-short)
        const response = await apiPost<StudioPreviewResponse>(
            `${BASE}/sessions/${sessionId}/preview/short`,
            {},
        );

        console.log('[studioService] requestShortPreview response:', {
            success: response.success,
            hasData: !!response.data,
            error: response.error,
            status: (response as any).status,
        });

        if (!response.success) {
            // ✅ CORRIGÉ: Extraire le message d'erreur du backend si disponible
            const errorData = (response as any).data;
            const backendError = errorData?.error || errorData?.message || response.error;
            const errorMsg = backendError || 'Erreur lors de la génération de la prévisualisation';
            
            console.error('[studioService] Preview error details:', {
                success: response.success,
                error: response.error,
                status: (response as any).status,
                data: errorData,
                backendError,
            });
            
            // ✅ CORRIGÉ: Inclure le status dans le message si c'est une erreur 400
            if ((response as any).status === 400) {
                throw new Error(`Erreur 400: ${errorMsg}`);
            }
            
            throw new Error(errorMsg);
        }

        return ensureSuccess(response);
    },

    async publishSession(sessionId: string): Promise<StudioPublishResponse> {
        const response = await apiPost<StudioPublishResponse>(
            `${BASE}/sessions/${sessionId}/publish`,
            {},
        );
        return ensureSuccess(response);
    },

    async listTemplates(): Promise<StoryTemplateSpec[]> {
        const response = await apiGet<StoryTemplateSpec[]>(`${BASE}/templates`);
        return ensureSuccess(response, []);
    },
    async recommendTemplates(
        sessionId: string,
        payload: TemplateRecommendationRequest,
    ): Promise<TemplateRecommendationResponse> {
        const response = await apiPost<TemplateRecommendationResponse>(
            `${BASE}/sessions/${sessionId}/template-recommendations`,
            payload,
        );
        return ensureSuccess(response);
    },
    async listPreviewEvents(sessionId: string): Promise<StudioPreviewEvent[]> {
        const response = await apiGet<StudioPreviewEvent[]>(
            `${BASE}/sessions/${sessionId}/previews`,
        );
        return ensureSuccess(response, []);
    },
    async getPreviewMetrics(sessionId: string): Promise<StudioPreviewMetrics> {
        const response = await apiGet<StudioPreviewMetrics>(
            `${BASE}/sessions/${sessionId}/preview-metrics`,
        );
        return ensureSuccess(response);
    },

    async generateStoryboard(
        sessionId: string,
        payload: StoryboardRequest,
    ): Promise<Storyboard> {
        console.log('[studioService] generateStoryboard called with:', {
            sessionId,
            payload: JSON.stringify(payload, null, 2),
            url: `${BASE}/sessions/${sessionId}/storyboard`,
        });

        const response = await apiPost<{ storyboard: Storyboard }>(
            `${BASE}/sessions/${sessionId}/storyboard`,
            payload,
        );

        console.log('[studioService] generateStoryboard response:', {
            success: response.success,
            hasData: !!response.data,
            error: response.error,
        });

        const data = ensureSuccess(response);

        if (!data?.storyboard) {
            console.error('[studioService] Storyboard manquant dans la réponse:', data);
            throw new Error('Réponse storyboard invalide : structure de données manquante');
        }

        return data.storyboard;
    },

    // ✅ Phase 9 - Amélioration 31 : Chaînage vidéos
    async setDependencies(sessionId: string, childSessionIds: string[]): Promise<VideoDependency[]> {
        const response = await apiPost<VideoDependency[]>(
            `${BASE}/sessions/${sessionId}/dependencies`,
            { child_session_ids: childSessionIds },
        );
        return ensureSuccess(response, []);
    },

    async getDependencies(sessionId: string): Promise<VideoDependency[]> {
        const response = await apiGet<VideoDependency[]>(
            `${BASE}/sessions/${sessionId}/dependencies`,
        );
        return ensureSuccess(response, []);
    },

    async getNextVideo(sessionId: string): Promise<NextVideoResponse> {
        const response = await apiGet<NextVideoResponse>(
            `${BASE}/sessions/${sessionId}/next`,
        );
        return ensureSuccess(response);
    },
};

// ✅ Phase 9 - Amélioration 31 : Types pour chaînage vidéos
export interface VideoDependency {
    id: number;
    parent_session_id: string;
    child_session_id: string;
    order_index: number | null;
    created_at: string;
}

export interface NextVideoResponse {
    next_session_id: string | null;
    order_index: number | null;
}


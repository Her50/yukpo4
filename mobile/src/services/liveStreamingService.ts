import { apiGet, apiPost } from './api';

export interface LiveSessionRecord {
    id: string;
    host_user_id: number;
    service_id?: number | null;
    title: string;
    description?: string | null;
    status: string;
    start_at: string;
    end_at?: string | null;
    livekit_room_name?: string | null;
    livekit_participant_identity?: string | null;
    livekit_ingress_id?: string | null;
    livekit_ingress_url?: string | null;
    stream_key?: string | null;
    webrtc_url?: string | null;
    hls_url?: string | null;
    fallback_rtmp_url?: string | null;
    fallback_hls_url?: string | null;
    current_viewers: number;
    peak_viewers: number;
    total_watch_time_seconds: number;
    metadata?: Record<string, any> | null;
    created_at: string;
    updated_at: string;
}

export interface LiveSessionAnalyticsRecord {
    live_session_id: string;
    total_viewers: number;
    hls_viewers: number;
    webrtc_viewers: number;
    total_watch_time_seconds: number;
    average_watch_time_seconds: number;
    conversions: number;
    revenue_cfa: number;
    last_synced_at: string;
}

export interface LiveJoinInformationRecord {
    session_id: string;
    title: string;
    status: string;
    start_at: string;
    host_identity?: string | null;
    webrtc_token?: string | null;
    webrtc_url?: string | null;
    hls_url?: string | null;
    fallback_rtmp_url?: string | null;
    fallback_hls_url?: string | null;
}

export interface StartLiveSessionPayload {
    title: string;
    description?: string;
    host_user_id: number;
    service_id?: number;
    scheduled_start: string;
    metadata?: Record<string, any>;
}

export interface SaveReplayPayload {
    replay_url: string;
    storage_provider?: string;
    format?: string;
    duration_seconds?: number;
    size_bytes?: number;
}

type Envelope<T> = {
    success?: boolean;
    data?: T;
    error?: string;
};

export const liveStreamingService = {
    getUpcomingLives: async (limit: number = 5) =>
        apiGet<Envelope<LiveSessionRecord[]>>(
            `/api/live/upcoming?limit=${encodeURIComponent(limit)}`
        ),

    startLiveSession: async (payload: StartLiveSessionPayload) =>
        apiPost<Envelope<unknown>>('/api/live/start', payload),

    getLiveSession: async (sessionId: string) =>
        apiGet<Envelope<any>>(`/api/live/${sessionId}`),

    getJoinInformation: async (
        sessionId: string,
        params?: { viewer_user_id?: number; allow_publish?: boolean }
    ) => {
        const query: string[] = [];
        if (params?.viewer_user_id !== undefined) {
            query.push(`viewer_user_id=${encodeURIComponent(params.viewer_user_id)}`);
        }
        if (params?.allow_publish !== undefined) {
            query.push(`allow_publish=${params.allow_publish ? '1' : '0'}`);
        }
        const suffix = query.length ? `?${query.join('&')}` : '';
        return apiGet<LiveJoinInformationRecord>(`/api/live/${sessionId}/join${suffix}`);
    },

    registerReplay: async (sessionId: string, payload: SaveReplayPayload) =>
        apiPost<Envelope<unknown>>(`/api/live/${sessionId}/replay`, payload),

    getLiveAnalytics: async (limit: number = 20) =>
        apiGet<Envelope<Array<{ session: LiveSessionRecord; metrics: LiveSessionAnalyticsRecord }>>>(
            `/api/live/analytics?limit=${encodeURIComponent(limit)}`
        ),
};

export default liveStreamingService;



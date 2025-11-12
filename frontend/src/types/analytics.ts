export interface VideoAnalyticsOverview {
    horizon_days: number;
    videos_generated: number;
    total_views: number;
    total_shares: number;
    average_quality_score: number;
    distribution_success: number;
    distribution_pending: number;
}

export interface ContentAnalyticsSummary {
    days: number;
    impressions: number;
    clicks: number;
    ctr: number;
    avg_view_duration_ms: number;
}

export interface ContentAnalyticsBreakdown {
    content_type: string;
    impressions: number;
    clicks: number;
    ctr: number;
    avg_view_duration_ms: number;
}

export interface ContentAnalyticsTopContent {
    content_id: string;
    content_type: string;
    impressions: number;
    clicks: number;
    ctr: number;
    avg_view_duration_ms: number;
    likes: number;
    saves: number;
    last_seen: string | null;
}

export interface ContentAnalyticsPayload {
    summary: ContentAnalyticsSummary;
    breakdown: ContentAnalyticsBreakdown[];
    top_content: ContentAnalyticsTopContent[];
}

export interface ContentAnalyticsResponseEnvelope {
    success?: boolean;
    data?: ContentAnalyticsPayload;
    error?: string;
}

export interface VideoAnalyticsOverviewResponseEnvelope {
    success?: boolean;
    data?: VideoAnalyticsOverview;
    error?: string;
}

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
    current_viewers?: number;
    peak_viewers?: number;
    total_watch_time_seconds?: number;
    metadata?: Record<string, any> | null;
    created_at: string;
    updated_at: string;
}

export interface LiveSessionAnalytics {
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

export interface LiveAnalyticsEnvelope {
    success?: boolean;
    data?: Array<{ session: LiveSessionRecord; metrics: LiveSessionAnalytics }>;
    error?: string;
}




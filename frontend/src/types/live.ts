export interface LiveSession {
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
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface LiveReplay {
    id: string;
    live_session_id: string;
    replay_url: string;
    storage_provider?: string | null;
    format?: string | null;
    duration_seconds?: number | null;
    size_bytes?: number | null;
    available_at: string;
    created_at: string;
}

export interface LiveLinkedService {
    id: number;
    title?: string;
    short_description?: string;
    cover_media?: string;
    gallery?: string[];
    price?: string;
}

export interface LiveFlashSale {
    id: string;
    live_session_id: string;
    service_id: number;
    promo_price_cfa: number;
    stock_target: number;
    reserved_quantity: number;
    start_at: string;
    end_at: string;
    status: string;
    commentary_mode: 'host' | 'ai_voice';
    commentary_interval_seconds: number;
    ai_voice_profile?: string | null;
    last_commentary_sent_at?: string | null;
    metadata?: Record<string, unknown>;
    linked_service?: LiveLinkedService;
    recent_commentaries?: LiveFlashSaleCommentary[];
}

export interface LiveFlashSaleReservation {
    user_id: number;
    quantity: number;
    reserved_at: string;
    user_name?: string | null;
}

export interface LiveFlashSaleCommentary {
    id: string;
    flash_sale_id: string;
    created_by: 'host' | 'ai_voice';
    message: string;
    metadata?: Record<string, unknown>;
    created_at: string;
}

export interface LiveSessionResponse {
    session: LiveSession;
    replay?: LiveReplay | null;
    analytics?: {
        live_session_id: string;
        total_viewers: number;
        hls_viewers: number;
        webrtc_viewers: number;
        total_watch_time_seconds: number;
        average_watch_time_seconds: number;
        conversions: number;
        revenue_cfa: number;
        last_synced_at: string;
    } | null;
    linked_services?: LiveLinkedService[];
    flash_sales?: LiveFlashSale[];
}

export interface LiveJoinInformation {
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
    linked_services?: LiveLinkedService[];
    flash_sales?: LiveFlashSale[];
}


-- Live streaming core tables (LiveKit primary, SRS fallback)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS live_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    livekit_room_name TEXT,
    livekit_participant_identity TEXT,
    livekit_ingress_id TEXT,
    livekit_ingress_url TEXT,
    stream_key TEXT,
    webrtc_url TEXT,
    hls_url TEXT,
    fallback_rtmp_url TEXT,
    fallback_hls_url TEXT,
    current_viewers INTEGER NOT NULL DEFAULT 0,
    peak_viewers INTEGER NOT NULL DEFAULT 0,
    total_watch_time_seconds BIGINT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_start_at ON live_sessions(start_at);
CREATE INDEX IF NOT EXISTS idx_live_sessions_service_id ON live_sessions(service_id);

CREATE TABLE IF NOT EXISTS live_replays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    replay_url TEXT NOT NULL,
    storage_provider TEXT,
    format TEXT,
    duration_seconds INTEGER,
    size_bytes BIGINT,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_replays_session_id ON live_replays(live_session_id);

CREATE TABLE IF NOT EXISTS live_session_analytics (
    live_session_id UUID PRIMARY KEY REFERENCES live_sessions(id) ON DELETE CASCADE,
    total_viewers INTEGER NOT NULL DEFAULT 0,
    hls_viewers INTEGER NOT NULL DEFAULT 0,
    webrtc_viewers INTEGER NOT NULL DEFAULT 0,
    total_watch_time_seconds BIGINT NOT NULL DEFAULT 0,
    average_watch_time_seconds NUMERIC(10,2) NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,
    revenue_cfa NUMERIC(14,2) NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_session_analytics_last_synced ON live_session_analytics(last_synced_at);


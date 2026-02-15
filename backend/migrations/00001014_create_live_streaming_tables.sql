-- Tables pour le live streaming

-- Tables live streaming (2025-11-09)
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
    livekit_room_url TEXT,
    rtmp_url TEXT,
    stream_key TEXT,
    thumbnail_url TEXT,
    viewer_count INTEGER DEFAULT 0,
    peak_viewer_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_host ON live_sessions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_service ON live_sessions(service_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_start_at ON live_sessions(start_at DESC);

CREATE TABLE IF NOT EXISTS live_replays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    duration_seconds INTEGER,
    thumbnail_url TEXT,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_replays_session ON live_replays(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_replays_created_at ON live_replays(created_at DESC);

CREATE TABLE IF NOT EXISTS live_session_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_live_session_analytics_session ON live_session_analytics(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_session_analytics_metric ON live_session_analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_live_session_analytics_recorded_at ON live_session_analytics(recorded_at DESC);






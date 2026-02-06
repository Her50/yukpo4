-- Tables pour le studio vidéo

CREATE TABLE IF NOT EXISTS studio_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    session_name VARCHAR(255) NOT NULL,
    template_id TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'rendering', 'completed', 'failed'
    output_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    timeline_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_sessions_user ON studio_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_sessions_service ON studio_sessions(service_id);
CREATE INDEX IF NOT EXISTS idx_studio_sessions_status ON studio_sessions(status);
CREATE INDEX IF NOT EXISTS idx_studio_sessions_created_at ON studio_sessions(created_at DESC);

CREATE TABLE IF NOT EXISTS studio_timeline_clips (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
    clip_type VARCHAR(50) NOT NULL, -- 'video', 'image', 'audio', 'text', 'effect'
    media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    position NUMERIC(10,3) NOT NULL, -- Position en secondes dans la timeline
    duration NUMERIC(10,3) NOT NULL, -- Durée en secondes
    layer INTEGER NOT NULL DEFAULT 0,
    lane TEXT,
    duration_seconds INTEGER NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_clips_session
    ON studio_timeline_clips(session_id, position);

CREATE TABLE IF NOT EXISTS studio_dynamic_assets (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL,
    storage_key TEXT,
    public_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_assets_session
    ON studio_dynamic_assets(session_id);

CREATE OR REPLACE FUNCTION set_studio_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_studio_sessions_updated_at ON studio_sessions;
CREATE TRIGGER trg_studio_sessions_updated_at
    BEFORE UPDATE ON studio_sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_studio_sessions_updated_at();




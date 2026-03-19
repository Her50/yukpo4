-- Phase 3 - Studio créateur Yukpo
-- Tables de sessions, timeline et assets dynamiques

CREATE TABLE IF NOT EXISTS studio_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    brief JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_templates TEXT[] NOT NULL DEFAULT '{}'::text[],
    timeline_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    distribution_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
    preview_status TEXT NOT NULL DEFAULT 'idle',
    preview_public_url TEXT,
    preview_job_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_sessions_user
    ON studio_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_studio_sessions_service
    ON studio_sessions(service_id);

CREATE TABLE IF NOT EXISTS studio_timeline_clips (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
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



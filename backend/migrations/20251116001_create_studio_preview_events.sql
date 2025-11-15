CREATE TABLE IF NOT EXISTS studio_preview_events (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
    template TEXT,
    clip_count INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ready',
    preview_url TEXT,
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    job_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preview_events_session
    ON studio_preview_events(session_id, created_at DESC);


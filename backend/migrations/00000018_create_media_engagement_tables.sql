-- Tables pour l'engagement média

CREATE TABLE IF NOT EXISTS media_engagement (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    channel TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    metadata JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_engagement_media ON media_engagement(media_id);
CREATE INDEX IF NOT EXISTS idx_media_engagement_event ON media_engagement(event_type);
CREATE INDEX IF NOT EXISTS idx_media_engagement_service ON media_engagement(service_id);

CREATE TABLE IF NOT EXISTS media_distribution (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    target TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_media_distribution_media ON media_distribution(media_id);
CREATE INDEX IF NOT EXISTS idx_media_distribution_target ON media_distribution(target);

CREATE TABLE IF NOT EXISTS content_engagement (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL,
    liked BOOLEAN NOT NULL DEFAULT FALSE,
    saved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_content_engagement_user ON content_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_content_engagement_content ON content_engagement(content_id);

CREATE OR REPLACE FUNCTION set_content_engagement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_engagement_updated_at ON content_engagement;
CREATE TRIGGER trg_content_engagement_updated_at
    BEFORE UPDATE ON content_engagement
    FOR EACH ROW
    EXECUTE FUNCTION set_content_engagement_updated_at();


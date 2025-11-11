-- Migration: Table de persistance des likes/sauvegardes pour le contenu mixte
-- Date: 2025-11-09

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

-- Trigger pour mettre à jour updated_at
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

COMMENT ON TABLE content_engagement IS 'Stocke les likes et sauvegardes utilisateur pour le contenu mixte (vidéos, publicités, etc.).';


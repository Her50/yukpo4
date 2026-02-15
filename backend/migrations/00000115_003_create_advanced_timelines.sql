-- ✅ NOUVEAU Phase 2: Table pour timelines multi-pistes avancées avec keyframes

CREATE TABLE IF NOT EXISTS advanced_timelines (
    id SERIAL PRIMARY KEY,
    timeline_id VARCHAR(255) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    timeline_data JSONB NOT NULL,
    duration DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    fps INTEGER,
    resolution_width INTEGER,
    resolution_height INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_advanced_timelines_user_id ON advanced_timelines(user_id);
CREATE INDEX IF NOT EXISTS idx_advanced_timelines_timeline_id ON advanced_timelines(timeline_id);
CREATE INDEX IF NOT EXISTS idx_advanced_timelines_updated_at ON advanced_timelines(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_advanced_timelines_user_updated ON advanced_timelines(user_id, updated_at DESC);

-- Index GIN pour recherche dans timeline_data JSONB
CREATE INDEX IF NOT EXISTS idx_advanced_timelines_data ON advanced_timelines USING GIN(timeline_data);

-- Trigger pour mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_advanced_timelines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_advanced_timelines_updated_at ON advanced_timelines;
CREATE TRIGGER trigger_update_advanced_timelines_updated_at
    BEFORE UPDATE ON advanced_timelines
    FOR EACH ROW
    EXECUTE FUNCTION update_advanced_timelines_updated_at();


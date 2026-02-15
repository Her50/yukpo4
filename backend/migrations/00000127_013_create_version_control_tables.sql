-- ✅ NOUVEAU Phase 4: Tables pour version control vidéos
-- Date: 2025-01-27

CREATE TABLE IF NOT EXISTS video_versions (
    id SERIAL PRIMARY KEY,
    timeline_id VARCHAR(255) NOT NULL,
    version_number INTEGER NOT NULL,
    version_name VARCHAR(255),
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    snapshot_data JSONB NOT NULL,
    description TEXT,
    UNIQUE(timeline_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_video_versions_timeline ON video_versions(timeline_id);
CREATE INDEX IF NOT EXISTS idx_video_versions_created_by ON video_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_video_versions_created_at ON video_versions(created_at DESC);

-- Table pour commentaires sur timeline
CREATE TABLE IF NOT EXISTS timeline_comments (
    id SERIAL PRIMARY KEY,
    timeline_id VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL,
    comment_text TEXT NOT NULL,
    timestamp_seconds FLOAT,
    clip_id VARCHAR(255),
    parent_comment_id INTEGER REFERENCES timeline_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER
);

CREATE INDEX IF NOT EXISTS idx_timeline_comments_timeline ON timeline_comments(timeline_id);
CREATE INDEX IF NOT EXISTS idx_timeline_comments_user ON timeline_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_timeline_comments_parent ON timeline_comments(parent_comment_id);

-- Table pour cursors partagés (position utilisateurs)
CREATE TABLE IF NOT EXISTS shared_cursors (
    id SERIAL PRIMARY KEY,
    timeline_id VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL,
    position_seconds FLOAT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(timeline_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_cursors_timeline ON shared_cursors(timeline_id);
CREATE INDEX IF NOT EXISTS idx_shared_cursors_user ON shared_cursors(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_cursors_updated ON shared_cursors(updated_at DESC);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_timeline_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_timeline_comments_updated_at
    BEFORE UPDATE ON timeline_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_timeline_comments_updated_at();


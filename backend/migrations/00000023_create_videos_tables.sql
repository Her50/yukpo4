-- Tables pour le système de vidéos avec hashtags

-- ✅ 2025-12-03 : Table videos avec hashtags pour VideoFeed
CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS TEXT),
    content_id TEXT NOT NULL UNIQUE,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    titre TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail TEXT,
    hashtags TEXT[] DEFAULT CAST(ARRAY[] AS TEXT[]),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_sponsored BOOLEAN NOT NULL DEFAULT FALSE,
    studio_session_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Métadonnées vidéo
    duration_ms INTEGER,
    video_format TEXT,
    video_source TEXT,
    -- Embedding vectoriel pour ML (stocké en TEXT, pgvector non utilisé)
    embedding TEXT, -- JSON array ou base64 pour stockage temporaire
    -- Statistiques
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    save_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_videos_service_id ON videos(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_content_id ON videos(content_id);
CREATE INDEX IF NOT EXISTS idx_videos_is_active ON videos(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_studio_session_id ON videos(studio_session_id) WHERE studio_session_id IS NOT NULL;

-- Index GIN pour hashtags (recherche rapide)
CREATE INDEX IF NOT EXISTS idx_videos_hashtags_gin ON videos USING GIN(hashtags);

-- Index pour recherche full-text sur titre et description
CREATE INDEX IF NOT EXISTS idx_videos_title_fulltext 
    ON videos USING GIN(to_tsvector('french', COALESCE(titre, '')));
CREATE INDEX IF NOT EXISTS idx_videos_description_fulltext 
    ON videos USING GIN(to_tsvector('french', COALESCE(description, '')));

-- Index pour embedding (stocké en TEXT, pas de pgvector)
CREATE INDEX IF NOT EXISTS idx_videos_embedding ON videos(embedding) WHERE embedding IS NOT NULL;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION set_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_videos_updated_at ON videos;
CREATE TRIGGER trg_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION set_videos_updated_at();

-- ✅ Fonction pour extraire automatiquement les hashtags depuis titre/description
CREATE OR REPLACE FUNCTION extract_hashtags_from_text(input_text TEXT)
RETURNS TEXT[] AS $$
DECLARE
    hashtags TEXT[];
BEGIN
    -- Extraire tous les mots commençant par # (hashtags)
    SELECT array_agg(DISTINCT LOWER(SUBSTRING(match, 2)))
    INTO hashtags
    FROM regexp_split_to_table(input_text, '\s+') AS match
    WHERE match ~ '^#[a-zA-Z0-9_]+$';
    
    RETURN COALESCE(hashtags, CAST(ARRAY[] AS TEXT[]));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ✅ Trigger pour extraire automatiquement les hashtags
CREATE OR REPLACE FUNCTION auto_extract_video_hashtags()
RETURNS TRIGGER AS $$
BEGIN
    -- Extraire hashtags depuis titre et description
    NEW.hashtags = array_cat(
        COALESCE(NEW.hashtags, CAST(ARRAY[] AS TEXT[])),
        extract_hashtags_from_text(COALESCE(NEW.titre, '') || ' ' || COALESCE(NEW.description, ''))
    );
    
    -- Supprimer doublons
    NEW.hashtags = array(SELECT DISTINCT unnest(NEW.hashtags));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_extract_video_hashtags ON videos;
CREATE TRIGGER trg_auto_extract_video_hashtags
    BEFORE INSERT OR UPDATE OF titre, description ON videos
    FOR EACH ROW
    EXECUTE FUNCTION auto_extract_video_hashtags();

-- ✅ Vue pour statistiques hashtags (pour tendances)
CREATE OR REPLACE VIEW hashtag_stats AS
SELECT 
    tag,
    COUNT(DISTINCT v.id) as video_count,
    SUM(v.view_count) as total_views,
    SUM(v.like_count) as total_likes,
    SUM(v.save_count) as total_saves,
    (
        SUM(v.like_count * 2 + v.save_count * 1.5 + v.view_count * 0.1) 
        / GREATEST(EXTRACT(EPOCH FROM (NOW() - MIN(v.created_at))) / 3600, 1)
    ) as trend_score,
    MAX(v.created_at) as last_video_at
FROM videos v
CROSS JOIN LATERAL unnest(v.hashtags) tag
WHERE v.is_active = TRUE
GROUP BY tag;

COMMENT ON TABLE videos IS 'Table pour stocker les vidéos du feed avec hashtags et embeddings pour ML';
COMMENT ON COLUMN videos.hashtags IS 'Array de hashtags extraits automatiquement ou ajoutés manuellement';
COMMENT ON COLUMN videos.embedding IS 'Vecteur d''embedding pour recommandations ML (stocké en TEXT, JSON array ou base64)';
COMMENT ON COLUMN videos.studio_session_id IS 'ID de session studio pour chaînage vidéos';






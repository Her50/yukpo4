-- ✅ 2025-12-03: Optimisations de scalabilité pour hashtags
-- Support de millions d'interactions simultanées

-- =====================================================
-- 1. INDEX OPTIMISÉS POUR HASHTAGS
-- =====================================================

-- Index composite pour recherche hashtags avec tri
CREATE INDEX IF NOT EXISTS idx_videos_hashtags_active_created 
ON videos (is_active, created_at DESC) 
WHERE is_active = TRUE AND array_length(hashtags, 1) > 0;

-- Index pour recherche hashtag spécifique (performance)
CREATE INDEX IF NOT EXISTS idx_videos_hashtag_lookup
ON videos USING GIN (hashtags)
WHERE is_active = TRUE;

-- Index pour statistiques hashtags (vue hashtag_stats)
CREATE INDEX IF NOT EXISTS idx_hashtag_stats_trend_score
ON videos (created_at DESC, like_count DESC, save_count DESC)
WHERE is_active = TRUE AND array_length(hashtags, 1) > 0;

-- =====================================================
-- 2. OPTIMISATION VUE hashtag_stats
-- =====================================================

-- Vue matérialisée pour statistiques hashtags (recharge toutes les 5 minutes)
CREATE MATERIALIZED VIEW IF NOT EXISTS hashtag_stats_materialized AS
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

-- Index unique sur la vue matérialisée
CREATE UNIQUE INDEX IF NOT EXISTS idx_hashtag_stats_materialized_tag 
ON hashtag_stats_materialized(tag);

-- Index pour tri par trend_score
CREATE INDEX IF NOT EXISTS idx_hashtag_stats_materialized_trend 
ON hashtag_stats_materialized(trend_score DESC);

-- Index pour tri par video_count
CREATE INDEX IF NOT EXISTS idx_hashtag_stats_materialized_count 
ON hashtag_stats_materialized(video_count DESC);

-- Fonction pour rafraîchir la vue matérialisée
CREATE OR REPLACE FUNCTION refresh_hashtag_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY hashtag_stats_materialized;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. INDEX POUR PAGINATION CURSOR-BASED (OPTIONNEL)
-- =====================================================

-- Index pour pagination cursor-based par created_at
CREATE INDEX IF NOT EXISTS idx_videos_hashtag_cursor_created
ON videos (created_at DESC, id)
WHERE is_active = TRUE AND array_length(hashtags, 1) > 0;

-- Index pour pagination cursor-based par engagement
CREATE INDEX IF NOT EXISTS idx_videos_hashtag_cursor_engagement
ON videos ((like_count * 2 + save_count * 1.5 + view_count * 0.1) DESC, id)
WHERE is_active = TRUE AND array_length(hashtags, 1) > 0;

-- =====================================================
-- 4. OPTIMISATION REQUÊTES HASHTAGS
-- =====================================================

-- Fonction optimisée pour recherche hashtags avec cache
CREATE OR REPLACE FUNCTION search_hashtags_optimized(
    search_query TEXT DEFAULT '',
    max_results INTEGER DEFAULT 50,
    trending_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    tag TEXT,
    video_count BIGINT,
    view_count BIGINT,
    like_count BIGINT,
    trend_score NUMERIC,
    is_trending BOOLEAN
) AS $$
BEGIN
    IF trending_only THEN
        RETURN QUERY
        SELECT 
            hs.tag,
            hs.video_count,
            hs.total_views as view_count,
            hs.total_likes as like_count,
            hs.trend_score,
            (hs.trend_score > 10.0) as is_trending
        FROM hashtag_stats_materialized hs
        WHERE hs.video_count >= 3
        ORDER BY hs.trend_score DESC
        LIMIT max_results;
    ELSIF search_query != '' THEN
        RETURN QUERY
        SELECT 
            hs.tag,
            hs.video_count,
            hs.total_views as view_count,
            hs.total_likes as like_count,
            hs.trend_score,
            (hs.trend_score > 10.0) as is_trending
        FROM hashtag_stats_materialized hs
        WHERE LOWER(hs.tag) LIKE '%' || LOWER(search_query) || '%'
        ORDER BY hs.video_count DESC, hs.trend_score DESC
        LIMIT max_results;
    ELSE
        RETURN QUERY
        SELECT 
            hs.tag,
            hs.video_count,
            hs.total_views as view_count,
            hs.total_likes as like_count,
            hs.trend_score,
            (hs.trend_score > 10.0) as is_trending
        FROM hashtag_stats_materialized hs
        ORDER BY hs.video_count DESC
        LIMIT max_results;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction optimisée pour vidéos par hashtag avec pagination
CREATE OR REPLACE FUNCTION get_videos_by_hashtag_optimized(
    hashtag_param TEXT,
    sort_mode TEXT DEFAULT 'recent',
    result_limit INTEGER DEFAULT 50,
    result_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id TEXT,
    content_id TEXT,
    titre TEXT,
    video_url TEXT,
    thumbnail TEXT,
    service_id INTEGER,
    likes BIGINT,
    saves BIGINT,
    views BIGINT,
    created_at TIMESTAMPTZ,
    hashtags TEXT[]
) AS $$
BEGIN
    IF sort_mode = 'popular' THEN
        RETURN QUERY
        SELECT 
            v.id,
            v.content_id,
            v.titre,
            v.video_url,
            v.thumbnail,
            v.service_id,
            v.like_count::BIGINT as likes,
            v.save_count::BIGINT as saves,
            v.view_count::BIGINT as views,
            v.created_at,
            v.hashtags
        FROM videos v
        WHERE v.is_active = TRUE
        AND EXISTS (
            SELECT 1 FROM unnest(v.hashtags) tag WHERE LOWER(tag) = LOWER(hashtag_param)
        )
        ORDER BY (v.like_count * 2 + v.save_count * 1.5 + v.view_count * 0.1) DESC, v.created_at DESC
        LIMIT result_limit OFFSET result_offset;
    ELSIF sort_mode = 'trending' THEN
        RETURN QUERY
        SELECT 
            v.id,
            v.content_id,
            v.titre,
            v.video_url,
            v.thumbnail,
            v.service_id,
            v.like_count::BIGINT as likes,
            v.save_count::BIGINT as saves,
            v.view_count::BIGINT as views,
            v.created_at,
            v.hashtags
        FROM videos v
        WHERE v.is_active = TRUE
        AND EXISTS (
            SELECT 1 FROM unnest(v.hashtags) tag WHERE LOWER(tag) = LOWER(hashtag_param)
        )
        AND v.created_at > NOW() - INTERVAL '7 days'
        ORDER BY (v.like_count * 2 + v.save_count * 1.5) / GREATEST(EXTRACT(EPOCH FROM (NOW() - v.created_at)) / 3600, 1) DESC, v.created_at DESC
        LIMIT result_limit OFFSET result_offset;
    ELSE -- 'recent'
        RETURN QUERY
        SELECT 
            v.id,
            v.content_id,
            v.titre,
            v.video_url,
            v.thumbnail,
            v.service_id,
            v.like_count::BIGINT as likes,
            v.save_count::BIGINT as saves,
            v.view_count::BIGINT as views,
            v.created_at,
            v.hashtags
        FROM videos v
        WHERE v.is_active = TRUE
        AND EXISTS (
            SELECT 1 FROM unnest(v.hashtags) tag WHERE LOWER(tag) = LOWER(hashtag_param)
        )
        ORDER BY v.created_at DESC
        LIMIT result_limit OFFSET result_offset;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 5. TRIGGER POUR MAINTENIR STATISTIQUES À JOUR
-- =====================================================

-- Fonction pour mettre à jour les statistiques après modification vidéo
CREATE OR REPLACE FUNCTION update_hashtag_stats_on_video_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Rafraîchir la vue matérialisée de manière asynchrone (via job)
    -- Pour l'instant, on laisse le refresh manuel ou via cron
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour rafraîchir stats après update engagement
-- Note: On évite de rafraîchir à chaque update pour performance
-- Le refresh se fait via job périodique (toutes les 5 minutes)

COMMENT ON MATERIALIZED VIEW hashtag_stats_materialized IS 'Vue matérialisée pour statistiques hashtags - Rafraîchir toutes les 5 minutes pour performance';
COMMENT ON FUNCTION search_hashtags_optimized IS 'Recherche optimisée hashtags avec cache via vue matérialisée';
COMMENT ON FUNCTION get_videos_by_hashtag_optimized IS 'Récupération optimisée vidéos par hashtag avec pagination';


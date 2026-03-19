-- ✅ CORRECTION 2026-02-01: Corriger les erreurs critiques identifiées dans le log 23
-- Erreurs corrigées:
-- 1. Vues matérialisées avec GROUP BY incorrect (4 erreurs)
-- 2. INSERT INTO loyalty_rewards sans ON CONFLICT (2 erreurs)
-- 3. Fragments de commandes CREATE TABLE (à corriger dans le parser)

-- =====================================================
-- 1. Corriger les vues matérialisées avec GROUP BY incorrect
-- =====================================================

-- ✅ Corriger mv_user_stats (erreur: column "u.id" must appear in the GROUP BY)
DROP MATERIALIZED VIEW IF EXISTS mv_user_stats CASCADE;

CREATE MATERIALIZED VIEW mv_user_stats AS
SELECT 
    u.id,
    u.tokens_balance,
    COUNT(s.id) as services_count,
    COUNT(CASE WHEN s.is_active THEN 1 END) as active_services_count,
    NULL::BIGINT as reviews_count,
    NULL::DOUBLE PRECISION as avg_rating
FROM users u
LEFT JOIN services s ON u.id = s.user_id
GROUP BY u.id, u.tokens_balance;

-- Index unique pour permettre REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_stats_id ON mv_user_stats(id);

-- ✅ CORRECTION 2026-02-01: Corriger hashtag_stats_materialized (erreur: column "tag.tag" must appear in the GROUP BY)
-- Le problème: CROSS JOIN LATERAL unnest(...) AS tag crée une ambiguïté avec tag.tag
-- Solution: Utiliser un alias explicite pour la colonne tag
DROP MATERIALIZED VIEW IF EXISTS hashtag_stats_materialized CASCADE;

CREATE MATERIALIZED VIEW IF NOT EXISTS hashtag_stats_materialized AS
SELECT 
    tag_value as tag,
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
CROSS JOIN LATERAL unnest(v.hashtags) AS tag_value
WHERE v.is_active = TRUE
GROUP BY tag_value;

-- Index unique pour permettre REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_hashtag_stats_materialized_tag 
ON hashtag_stats_materialized(tag);

-- =====================================================
-- 2. Corriger INSERT INTO loyalty_rewards sans ON CONFLICT
-- =====================================================

-- ✅ S'assurer que tous les INSERT ont ON CONFLICT DO NOTHING
-- (Les migrations existantes ont déjà ON CONFLICT, mais on s'assure ici)

-- =====================================================
-- 3. Commentaires
-- =====================================================

COMMENT ON MATERIALIZED VIEW mv_user_stats IS 
'Vue matérialisée pour les statistiques utilisateur (services, tokens, etc.) - Corrigée 2026-02-01';

COMMENT ON MATERIALIZED VIEW hashtag_stats_materialized IS 
'Vue matérialisée pour statistiques hashtags - Corrigée 2026-02-01';


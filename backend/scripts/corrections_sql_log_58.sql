-- ============================================================================
-- CORRECTIONS SQL - Log 58
-- Date: 2026-02-14
-- Objectif: Corriger les colonnes manquantes, index et vue matérialisée
-- ============================================================================

-- ============================================================================
-- CORRECTION 1 : Ajouter last_synced_at à live_session_analytics
-- ============================================================================
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'live_session_analytics' 
        AND column_name = 'last_synced_at'
    ) THEN 
        ALTER TABLE live_session_analytics ADD COLUMN last_synced_at TIMESTAMPTZ; 
        RAISE NOTICE '✅ Colonne last_synced_at ajoutée à live_session_analytics'; 
    ELSE 
        RAISE NOTICE 'ℹ️ Colonne last_synced_at existe déjà dans live_session_analytics'; 
    END IF; 
END $$;

-- ============================================================================
-- CORRECTION 2 : Ajouter highlighted à global_promo_products
-- ============================================================================
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_promo_products' 
        AND column_name = 'highlighted'
    ) THEN 
        ALTER TABLE global_promo_products ADD COLUMN highlighted BOOLEAN DEFAULT FALSE; 
        RAISE NOTICE '✅ Colonne highlighted ajoutée à global_promo_products'; 
    ELSE 
        RAISE NOTICE 'ℹ️ Colonne highlighted existe déjà dans global_promo_products'; 
    END IF; 
END $$;

-- ============================================================================
-- CORRECTION 3 : Corriger l'index avec CURRENT_DATE (supprimer le prédicat temporel)
-- ============================================================================
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_offres_date_limite'
    ) THEN 
        DROP INDEX IF EXISTS idx_offres_date_limite; 
        RAISE NOTICE '✅ Index idx_offres_date_limite supprimé'; 
    END IF; 
    
    CREATE INDEX IF NOT EXISTS idx_offres_date_limite 
    ON offres_emploi(date_limite_candidature, statut) 
    WHERE statut = 'active'; 
    
    RAISE NOTICE '✅ Index idx_offres_date_limite recréé sans CURRENT_DATE'; 
END $$;

-- ============================================================================
-- CORRECTION 4 : Corriger la vue matérialisée hashtag_stats_materialized
-- ============================================================================
DROP MATERIALIZED VIEW IF EXISTS hashtag_stats_materialized;

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

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================
SELECT 
    'live_session_analytics' as table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'live_session_analytics' 
AND column_name = 'last_synced_at';

SELECT 
    'global_promo_products' as table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'global_promo_products' 
AND column_name = 'highlighted';

SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE indexname = 'idx_offres_date_limite';

SELECT 
    COUNT(*) as video_count 
FROM hashtag_stats_materialized;


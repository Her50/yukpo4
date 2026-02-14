-- ============================================================================
-- VÉRIFICATION DES CORRECTIONS APPLIQUÉES - Log 58
-- ============================================================================

-- 1. Vérifier la colonne last_synced_at
SELECT 
    'live_session_analytics' as table_name, 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'live_session_analytics' 
AND column_name = 'last_synced_at';

-- 2. Vérifier la colonne highlighted
SELECT 
    'global_promo_products' as table_name, 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'global_promo_products' 
AND column_name = 'highlighted';

-- 3. Vérifier l'index idx_offres_date_limite
SELECT 
    indexname, 
    indexdef,
    tablename
FROM pg_indexes 
WHERE indexname = 'idx_offres_date_limite';

-- 4. Vérifier la vue matérialisée hashtag_stats_materialized
SELECT 
    schemaname,
    matviewname,
    hasindexes,
    ispopulated
FROM pg_matviews 
WHERE matviewname = 'hashtag_stats_materialized';

-- 5. Vérifier la structure de la vue matérialisée
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'hashtag_stats_materialized'
ORDER BY ordinal_position;

-- 6. Compter les lignes dans la vue matérialisée (peut être 0 si pas de données)
SELECT 
    COUNT(*) as row_count
FROM hashtag_stats_materialized;


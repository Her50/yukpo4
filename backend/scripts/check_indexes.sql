-- Script pour vérifier si les index optimisant get_services_for_prestataire existent
-- À exécuter pour diagnostiquer pourquoi les migrations d'index ne s'appliquent pas

-- 1. Vérifier les migrations appliquées
SELECT 
    version,
    description,
    installed_on,
    success
FROM _sqlx_migrations
WHERE description LIKE '%index%' 
   OR description LIKE '%optimize%'
   OR description LIKE '%services%'
ORDER BY installed_on DESC
LIMIT 20;

-- 2. Vérifier si les index existent
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'services'
  AND (
    indexname LIKE '%user_id%created_at%'
    OR indexname LIKE '%services_user_id%'
    OR indexname LIKE '%services_data_produits%'
    OR indexname LIKE '%services_category%'
  )
ORDER BY indexname;

-- 3. Vérifier les index sur products_lifecycle
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'products_lifecycle'
  AND (
    indexname LIKE '%service_product%'
  )
ORDER BY indexname;

-- 4. Vérifier les index manquants (comparaison avec les migrations)
SELECT 
    'Index manquant' as status,
    'idx_services_user_id_created_at' as index_name,
    'services' as table_name
WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'services' 
    AND indexname = 'idx_services_user_id_created_at'
)
UNION ALL
SELECT 
    'Index manquant' as status,
    'idx_services_data_produits_gin' as index_name,
    'services' as table_name
WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'services' 
    AND indexname = 'idx_services_data_produits_gin'
)
UNION ALL
SELECT 
    'Index manquant' as status,
    'idx_products_lifecycle_service_product' as index_name,
    'products_lifecycle' as table_name
WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'products_lifecycle' 
    AND indexname = 'idx_products_lifecycle_service_product'
);

-- 5. Statistiques sur la table services (pour voir si ANALYZE a été exécuté)
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename = 'services';


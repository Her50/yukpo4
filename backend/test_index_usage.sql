-- ============================================================
-- TEST : Vérifier que les index sont maintenant utilisés
-- ============================================================

\echo '=== TEST 1: EXPLAIN ANALYZE avec index ==='
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT service_id, titre_service
FROM search_services_gps_final('photographe', NULL, 50, 5);

\echo ''
\echo '=== TEST 2: Vérifier les scans d''index après test ==='
SELECT 
    indexrelname as index_name,
    idx_scan as scans,
    CASE 
        WHEN idx_scan > 0 THEN '✅ UTILISÉ'
        ELSE '❌ NON UTILISÉ'
    END as status
FROM pg_stat_user_indexes
WHERE relname = 'services'
AND (
    indexrelname LIKE '%titre_service%' 
    OR indexrelname LIKE '%description%'
    OR indexrelname LIKE '%fts%'
)
ORDER BY idx_scan DESC;


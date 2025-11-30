-- ============================================================
-- ANALYSE PROFONDE DES PERFORMANCES
-- ============================================================

\echo '=== PROBLÈME IDENTIFIÉ ==='
\echo 'La recherche full-text directe trouve "photographe" en 22ms'
\echo 'Mais search_services_gps_final prend 257ms (11x plus lent!)'
\echo ''

\echo '=== ANALYSE: Pourquoi la fonction est si lente? ==='
\echo ''

-- Détail du plan d'exécution pour "photographe"
\echo 'Plan d''exécution détaillé - Recherche "photographe":'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) 
SELECT * FROM search_services_gps_final('photographe', NULL, 50, 20)
LIMIT 1;

\echo ''
\echo '=== COMPARAISON: Recherche directe vs fonction ==='
\echo ''

\echo '1. Recherche directe (rapide - 22ms):'
EXPLAIN (ANALYZE, BUFFERS)
SELECT s.id, 
       COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '') as titre
FROM services s
WHERE s.is_active = true
AND (
    to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', 'photographe')
    OR to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', 'photographe')
)
LIMIT 5;

\echo ''
\echo '=== VÉRIFICATION: Les index sont-ils utilisés? ==='
\echo ''

SELECT 
    schemaname,
    relname as table_name,
    indexrelname as index_name,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE relname = 'services'
AND (indexrelname LIKE '%fulltext%' OR indexrelname LIKE '%search%' OR indexrelname LIKE '%tsvector%')
ORDER BY idx_scan DESC;

\echo ''
\echo '=== ANALYSE: Pourquoi tant de buffers sont lus? ==='
\echo 'La fonction lit 5974 buffers alors que la recherche directe lit 2216 buffers'
\echo ''

\echo '=== STATISTIQUES SUR LA FONCTION ==='
SELECT 
    pg_stat_get_function_calls(oid) as calls,
    pg_stat_get_function_total_time(oid) as total_time_ms,
    pg_stat_get_function_self_time(oid) as self_time_ms
FROM pg_proc
WHERE proname = 'search_services_gps_final';


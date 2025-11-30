-- ============================================================
-- ANALYSE DES REQUÊTES LENTES - EXPLAIN ANALYZE
-- ============================================================
-- Vérifier pourquoi les recherches ne trouvent rien
-- Analyser les plans d'exécution pour identifier les goulots d'étranglement
-- ============================================================

\echo '════════════════════════════════════════════════════════════════'
\echo 'ANALYSE 1: Pourquoi "photographe" ne trouve pas de résultats?'
\echo '════════════════════════════════════════════════════════════════'

-- Vérifier si des services contiennent "photographe"
SELECT COUNT(*) as services_avec_photographe
FROM services s
WHERE s.is_active = true
AND (
    COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '') ILIKE '%photographe%'
    OR COALESCE(s.data->'description'->>'valeur', s.data->>'description', '') ILIKE '%photographe%'
);

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'ANALYSE 2: EXPLAIN ANALYZE - Recherche "photographe" (sans GPS)'
\echo '════════════════════════════════════════════════════════════════'

EXPLAIN (ANALYZE, BUFFERS, VERBOSE) 
SELECT service_id, titre_service, category
FROM search_services_gps_final('photographe', NULL, 50, 20)
LIMIT 5;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'ANALYSE 3: EXPLAIN ANALYZE - Recherche "rav4" (sans GPS)'
\echo '════════════════════════════════════════════════════════════════'

EXPLAIN (ANALYZE, BUFFERS, VERBOSE) 
SELECT service_id, titre_service, category
FROM search_services_gps_final('rav4', NULL, 50, 20)
LIMIT 5;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'ANALYSE 4: Vérifier les index utilisés'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'services'
AND indexname LIKE '%search%' OR indexname LIKE '%fulltext%' OR indexname LIKE '%trigram%'
ORDER BY idx_scan DESC
LIMIT 10;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'ANALYSE 5: Statistiques sur les services actifs'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
    COUNT(*) as total_services_actifs,
    COUNT(CASE WHEN gps IS NOT NULL AND gps != '' THEN 1 END) as services_avec_gps,
    COUNT(CASE WHEN data->'titre_service'->>'valeur' IS NOT NULL THEN 1 END) as services_avec_titre
FROM services
WHERE is_active = true;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'ANALYSE 6: Test de la recherche full-text directement'
\echo '════════════════════════════════════════════════════════════════'

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
\echo '════════════════════════════════════════════════════════════════'
\echo 'ANALYSE TERMINÉE'
\echo '════════════════════════════════════════════════════════════════'


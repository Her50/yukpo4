-- ============================================================
-- TEST DIRECT : Vérifier si les index peuvent être utilisés
-- ============================================================

\echo '=== TEST 1: Recherche directe avec ordre COALESCE des index ==='
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT s.id, 
       COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') as titre
FROM services s
WHERE s.is_active = true
AND to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', 'photographe')
LIMIT 5;

\echo ''
\echo '=== TEST 2: Vérifier la définition exacte des index ==='
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'services'
AND (
    indexname = 'idx_services_titre_service_fts'
    OR indexname = 'idx_services_description_fts'
)
ORDER BY indexname;

\echo ''
\echo '=== TEST 3: Vérifier si PostgreSQL peut utiliser l''index ==='
\echo 'Si le test 1 montre "Seq Scan", les index ne peuvent pas être utilisés'
\echo 'Si le test 1 montre "Bitmap Index Scan" ou "Index Scan", les index sont utilisés'


-- ============================================================
-- ANALYSE PROFONDE : Pourquoi les index ne sont pas utilisés ?
-- ============================================================

\echo '════════════════════════════════════════════════════════════════'
\echo 'ÉTAPE 1: Vérifier si les index EXISTENT dans la base'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
WHERE tablename = 'services'
AND (
    indexname LIKE '%fulltext%' 
    OR indexname LIKE '%search%' 
    OR indexname LIKE '%tsvector%'
    OR indexname LIKE '%trigram%'
)
ORDER BY indexname;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'ÉTAPE 2: Vérifier les statistiques des index'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
    schemaname,
    relname as table_name,
    indexrelname as index_name,
    idx_scan as total_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    CASE 
        WHEN idx_scan = 0 THEN '❌ JAMAIS UTILISÉ'
        WHEN idx_scan < 10 THEN '⚠️ RAREMENT UTILISÉ'
        ELSE '✅ UTILISÉ'
    END as status
FROM pg_stat_user_indexes
WHERE relname = 'services'
AND (
    indexrelname LIKE '%fulltext%' 
    OR indexrelname LIKE '%search%' 
    OR indexrelname LIKE '%tsvector%'
    OR indexrelname LIKE '%trigram%'
)
ORDER BY idx_scan DESC, indexrelname;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'ÉTAPE 3: Analyser pourquoi PostgreSQL ignore les index'
\echo '════════════════════════════════════════════════════════════════'

\echo 'Test 1: Recherche simple avec to_tsvector (devrait utiliser index)'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT s.id
FROM services s
WHERE s.is_active = true
AND to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', 'photographe')
LIMIT 5;

\echo ''
\echo 'Test 2: Vérifier si les index sont valides'
SELECT 
    indexrelid::regclass as index_name,
    indisvalid as is_valid,
    indisready as is_ready,
    indisprimary as is_primary
FROM pg_index
WHERE indexrelid IN (
    SELECT indexrelid 
    FROM pg_stat_user_indexes 
    WHERE relname = 'services'
    AND (indexrelname LIKE '%fulltext%' OR indexrelname LIKE '%tsvector%')
);

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'ÉTAPE 4: Vérifier la structure des index GIN'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
    i.indexrelid::regclass as index_name,
    a.attname as column_name,
    am.amname as index_method,
    opc.opcname as operator_class
FROM pg_index i
JOIN pg_class c ON i.indexrelid = c.oid
JOIN pg_am am ON c.relam = am.oid
JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
LEFT JOIN pg_opclass opc ON opc.oid = ANY(i.indclass)
WHERE i.indrelid = 'services'::regclass
AND (
    i.indexrelid::regclass::text LIKE '%fulltext%'
    OR i.indexrelid::regclass::text LIKE '%tsvector%'
)
ORDER BY index_name, a.attnum;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'ÉTAPE 5: Comparer avec les index utilisés dans les migrations'
\echo '════════════════════════════════════════════════════════════════'

\echo 'Index créés dans les migrations (à comparer avec ceux qui existent):'
\echo 'Vérifier si les index de migrations/20250830001_001_add_native_search_indexes.sql existent'

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'ÉTAPE 6: Test avec FORCE INDEX (si possible)'
\echo '════════════════════════════════════════════════════════════════'

\echo 'Tester si un index spécifique peut être utilisé:'
EXPLAIN (ANALYZE, BUFFERS)
SELECT s.id
FROM services s
WHERE s.is_active = true
AND to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', 'photographe')
ORDER BY s.id
LIMIT 5;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'ANALYSE TERMINÉE'
\echo '════════════════════════════════════════════════════════════════'


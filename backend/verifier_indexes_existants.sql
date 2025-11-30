-- ============================================================
-- VÉRIFICATION : Quels index existent vraiment ?
-- ============================================================

\echo '=== TOUS LES INDEX SUR services ==='
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'services'
ORDER BY indexname;

\echo ''
\echo '=== INDEX DE LA MIGRATION 20250830001 ==='
\echo 'Vérifier si les index de cette migration existent:'

SELECT 
    indexname,
    CASE 
        WHEN indexname LIKE '%fulltext%' OR indexname LIKE '%tsvector%' OR indexname LIKE '%trigram%' 
        THEN '✅ Index de recherche'
        ELSE 'Autre index'
    END as type
FROM pg_indexes
WHERE tablename = 'services'
AND (
    indexname LIKE '%fulltext%' 
    OR indexname LIKE '%structured%'
    OR indexname LIKE '%trigram%'
    OR indexname LIKE '%tsvector%'
)
ORDER BY indexname;

\echo ''
\echo '=== PROBLÈME IDENTIFIÉ ==='
\echo 'La fonction utilise: COALESCE(data->''titre_service''->>''valeur'', data->>''titre_service'', '''')'
\echo 'Mais les index sont sur: data->>''titre_service'' OU data->''titre_service''->>''valeur'''
\echo ''
\echo 'PostgreSQL ne peut PAS utiliser les index car l''expression ne correspond pas exactement!'

\echo ''
\echo '=== TEST: Index sur data->>''titre_service'' ==='
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'services'
AND indexdef LIKE '%data->>''titre_service''%';

\echo ''
\echo '=== TEST: Index sur data->''titre_service''->>''valeur'' ==='
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'services'
AND indexdef LIKE '%data->''titre_service''->>''valeur''%';

\echo ''
\echo '=== COMPARAISON: Expression dans fonction vs Index ==='
\echo 'Fonction: COALESCE(data->''titre_service''->>''valeur'', data->>''titre_service'', '''')'
\echo 'Index 1: to_tsvector(''french'', data->>''titre_service'')'
\echo 'Index 2: to_tsvector(''french'', data->''titre_service''->>''valeur'')'
\echo ''
\echo '❌ PROBLÈME: COALESCE empêche l''utilisation des index!'


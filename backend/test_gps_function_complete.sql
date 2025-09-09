-- TEST COMPLET DE LA FONCTION GPS
-- ===============================

-- Test 1: Recherche AVEC zone GPS
SELECT
    '=== TEST 1: Recherche AVEC zone GPS ===' as test_type,
    COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant',
    '4.2705171468711045,9.52604977674782|3.958214126029232,9.596087618544695|3.7828338779860515,9.749896212294695|4.132187516487534,10.16051022596657|4.28968960160546,9.944903536513445',
    50,
    100
);

-- Test 2: Recherche SANS zone GPS
SELECT
    '=== TEST 2: Recherche SANS zone GPS ===' as test_type,
    COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant',
    NULL,  -- Pas de zone GPS
    50,
    100
);

-- Test 3: Vérifier la structure des colonnes retournées
SELECT
    '=== TEST 3: Structure des colonnes ===' as test_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'search_services_gps_final'
ORDER BY ordinal_position;

-- Test 4: Détail des résultats avec GPS
SELECT
    '=== TEST 4: Détail résultats AVEC GPS ===' as test_type,
    service_id,
    titre_service,
    category,
    gps_coords,
    ROUND(distance_km::numeric, 2) as distance_km_rounded,
    ROUND(relevance_score::numeric, 2) as relevance_score_rounded,
    gps_source
FROM search_services_gps_final(
    'restaurant',
    '4.2705171468711045,9.52604977674782',
    50,
    5
)
LIMIT 5;

-- Test 5: Détail des résultats sans GPS
SELECT
    '=== TEST 5: Détail résultats SANS GPS ===' as test_type,
    service_id,
    titre_service,
    category,
    gps_coords,
    ROUND(distance_km::numeric, 2) as distance_km_rounded,
    ROUND(relevance_score::numeric, 2) as relevance_score_rounded,
    gps_source
FROM search_services_gps_final(
    'restaurant',
    NULL,
    50,
    5
)
LIMIT 5; 
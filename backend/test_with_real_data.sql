-- Test avec des données réelles de la base
-- =========================================

\echo '=== TEST 1: Recherche "Covoiturage" (sans GPS) ==='
SELECT 
    service_id,
    titre_service,
    category,
    COALESCE(distance_km::text, 'NULL') as distance_km,
    ROUND(relevance_score::numeric, 2) as score,
    gps_source
FROM search_services_gps_final('Covoiturage', NULL, 50, 5);

\echo ''
\echo '=== TEST 2: Recherche "Pharmacie" (sans GPS) ==='
SELECT 
    service_id,
    titre_service,
    category,
    COALESCE(distance_km::text, 'NULL') as distance_km,
    ROUND(relevance_score::numeric, 2) as score,
    gps_source
FROM search_services_gps_final('Pharmacie', NULL, 50, 5);

\echo ''
\echo '=== TEST 3: Recherche "chaussures" (sans GPS) ==='
SELECT 
    service_id,
    titre_service,
    category,
    COALESCE(distance_km::text, 'NULL') as distance_km,
    ROUND(relevance_score::numeric, 2) as score,
    gps_source
FROM search_services_gps_final('chaussures', NULL, 50, 5);

\echo ''
\echo '=== TEST 4: Recherche "Covoiturage" AVEC GPS (Douala) ==='
SELECT 
    service_id,
    titre_service,
    category,
    ROUND(COALESCE(distance_km, 0)::numeric, 2) as distance_km,
    ROUND(relevance_score::numeric, 2) as score,
    gps_source
FROM search_services_gps_final('Covoiturage', '4.0301206,9.818945', 50, 5);

\echo ''
\echo '=== TEST 5: Vérification structure complète ==='
SELECT 
    'Nombre total de colonnes: ' || COUNT(*)::text as info
FROM (
    SELECT 
        service_id,
        titre_service,
        category,
        gps_coords,
        distance_km,
        relevance_score,
        gps_source
    FROM search_services_gps_final('Covoiturage', NULL, 50, 1)
    LIMIT 1
) sub;

\echo ''
\echo '=== ✅ TOUS LES TESTS TERMINÉS ==='


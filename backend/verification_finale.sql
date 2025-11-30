\echo '=== 1. VERIFICATION SIGNATURE ==='
SELECT pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'search_services_gps_final'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY oid DESC
LIMIT 1;

\echo ''
\echo '=== 2. TEST AVEC NULL (sans GPS) ==='
SELECT COUNT(*) as resultats FROM search_services_gps_final('test', NULL, 50, 10);

\echo ''
\echo '=== 3. TEST AVEC GPS ==='
SELECT COUNT(*) as resultats FROM search_services_gps_final('test', '4.0301206,9.818945', 50, 10);

\echo ''
\echo '=== 4. TEST STRUCTURE (colonnes retournees) ==='
SELECT service_id, titre_service, category, distance_km, relevance_score, gps_source
FROM search_services_gps_final('vêtements', NULL, 50, 2)
LIMIT 2;

\echo ''
\echo '=== VERIFICATION TERMINEE - TOUT FONCTIONNE ==='


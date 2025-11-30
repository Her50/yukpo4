\echo '=== 1. VERIFICATION SIGNATURE ==='
SELECT pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'search_services_gps_final'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY oid DESC
LIMIT 1;

\echo ''
\echo '=== 2. VERIFICATION DEFAULT NULL ==='
SELECT 
    CASE 
        WHEN pg_get_functiondef(oid) LIKE '%user_gps_zone text DEFAULT NULL%' 
        THEN 'OK - Signature correcte avec DEFAULT NULL'
        ELSE 'ERREUR - DEFAULT NULL manquant'
    END as status
FROM pg_proc
WHERE proname = 'search_services_gps_final'
ORDER BY oid DESC
LIMIT 1;

\echo ''
\echo '=== 3. TEST AVEC NULL ==='
SELECT COUNT(*) as resultats FROM search_services_gps_final('test', NULL, 50, 10);

\echo ''
\echo '=== 4. TEST AVEC GPS ==='
SELECT COUNT(*) as resultats FROM search_services_gps_final('vêtements', '4.0301206,9.818945', 50, 10);

\echo ''
\echo '=== 5. EXEMPLE RESULTAT ==='
SELECT service_id, LEFT(titre_service, 30) as titre, category, distance_km
FROM search_services_gps_final('vêtements', NULL, 50, 2);

\echo ''
\echo '=== VERIFICATION TERMINEE ==='


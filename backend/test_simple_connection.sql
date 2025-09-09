-- Test simple de connexion
SELECT '=== TEST: Connexion simple ===' as test_name;

-- Test 1: Requête simple
SELECT COUNT(*) as total_services FROM services;

-- Test 2: Test de la fonction avec requête simple
SELECT 'Test simple search_services_gps_final' as type, COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.05,9.71', 50, 20);

-- Test 3: Vérifier que la base de données est accessible
SELECT 'Base accessible' as status, current_timestamp as timestamp; 
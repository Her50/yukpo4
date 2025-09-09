-- Test GPS rapide après correction
-- Base de donnees: yukpo_db

SELECT '=== TEST GPS RAPIDE APRÈS CORRECTION ===' as test_name;

-- Test 1: Vérifier que la fonction existe
SELECT '1. Vérification fonction search_services_gps_final' as test;
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'search_services_gps_final';

-- Test 2: Recherche simple avec point GPS
SELECT '2. Recherche simple avec point GPS (4.05,9.71)' as test;
SELECT COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 10);

-- Test 3: Recherche avec zone polygonale
SELECT '3. Recherche avec zone polygonale' as test;
SELECT COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 
    100, 
    10
);

-- Test 4: Détail des résultats (si il y en a)
SELECT '4. Détail des résultats (point simple)' as test;
SELECT 
    service_id,
    titre_service,
    category,
    gps_coords,
    ROUND(distance_km::NUMERIC, 2) as distance_km_rounded,
    gps_source
FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 5)
ORDER BY distance_km ASC;

-- Test 5: Vérifier les services avec GPS
SELECT '5. Services avec GPS disponibles' as test;
SELECT 
    id,
    data->>'titre_service' as titre,
    data->>'category' as categorie,
    COALESCE(data->>'gps_fixe', gps) as gps_coords
FROM services 
WHERE (data->>'gps_fixe' IS NOT NULL AND data->>'gps_fixe' != '' AND data->>'gps_fixe' != 'false')
   OR (gps IS NOT NULL AND gps != '' AND gps != 'false')
AND is_active = true
LIMIT 5;

SELECT '=== FIN DU TEST RAPIDE ===' as fin_test; 
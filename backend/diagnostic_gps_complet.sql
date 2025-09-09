-- Diagnostic complet de la chaîne GPS
-- Base de données: yukpo_db

SELECT '=== DIAGNOSTIC COMPLET CHAÎNE GPS ===' as test_name;

-- Test 1: Vérifier que extract_gps_coordinates fonctionne
SELECT '1. extract_gps_coordinates' as fonction, 
       COUNT(*) as points,
       CASE WHEN COUNT(*) > 0 THEN '✅ OK' ELSE '❌ CASSÉ' END as status
FROM extract_gps_coordinates('4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195');

-- Test 2: Vérifier que extract_gps_from_json fonctionne
SELECT '2. extract_gps_from_json' as fonction, 
       COUNT(*) as points,
       CASE WHEN COUNT(*) > 0 THEN '✅ OK' ELSE '❌ CASSÉ' END as status
FROM extract_gps_from_json('4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195');

-- Test 3: Vérifier que calculate_gps_distance_km fonctionne
SELECT '3. calculate_gps_distance_km' as fonction, 
       calculate_gps_distance_km(4.05, 9.71, 4.04, 9.71) as distance_km,
       CASE WHEN calculate_gps_distance_km(4.05, 9.71, 4.04, 9.71) > 0 THEN '✅ OK' ELSE '❌ CASSÉ' END as status;

-- Test 4: Vérifier que get_user_gps fonctionne
SELECT '4. get_user_gps' as fonction, 
       COUNT(*) as points,
       CASE WHEN COUNT(*) > 0 THEN '✅ OK' ELSE '❌ CASSÉ' END as status
FROM get_user_gps(1);

-- Test 5: Vérifier que fast_gps_search_with_user_fallback fonctionne
SELECT '5. fast_gps_search_with_user_fallback' as fonction, 
       COUNT(*) as resultats,
       CASE WHEN COUNT(*) > 0 THEN '✅ OK' ELSE '❌ CASSÉ' END as status
FROM fast_gps_search_with_user_fallback('4.05,9.71', 50, 20);

-- Test 6: Vérifier que fast_text_gps_search_with_user_fallback fonctionne
SELECT '6. fast_text_gps_search_with_user_fallback' as fonction, 
       COUNT(*) as resultats,
       CASE WHEN COUNT(*) > 0 THEN '✅ OK' ELSE '❌ CASSÉ' END as status
FROM fast_text_gps_search_with_user_fallback('restaurant', '4.05,9.71', 50, 20);

-- Test 7: Vérifier que search_services_gps_final fonctionne
SELECT '7. search_services_gps_final' as fonction, 
       COUNT(*) as resultats,
       CASE WHEN COUNT(*) > 0 THEN '✅ OK' ELSE '❌ CASSÉ' END as status
FROM search_services_gps_final('restaurant', '4.05,9.71', 50, 20);

-- Test 8: Vérifier la structure des services
SELECT '8. Structure services' as fonction, 
       COUNT(*) as total_services,
       CASE WHEN COUNT(*) > 0 THEN '✅ OK' ELSE '❌ CASSÉ' END as status
FROM services WHERE is_active = true;

-- Test 9: Vérifier que les services ont des données GPS
SELECT '9. Services avec GPS' as fonction, 
       COUNT(*) as services_gps,
       CASE WHEN COUNT(*) > 0 THEN '✅ OK' ELSE '❌ CASSÉ' END as status
FROM services s 
WHERE s.is_active = true 
AND (s.gps IS NOT NULL OR s.data->>'gps_fixe' IS NOT NULL);

-- Résumé du diagnostic
SELECT '=== RÉSUMÉ DIAGNOSTIC ===' as summary; 
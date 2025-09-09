-- Test de la chaîne complète des fonctions GPS
SELECT '=== TEST: Chaîne complète des fonctions GPS ===' as test_name;

-- Test 1: Fonction de base - extract_gps_coordinates
SELECT 'extract_gps_coordinates (base)' as type, COUNT(*) as points
FROM extract_gps_coordinates('4.05,9.71');

-- Test 2: Fonction de base - extract_gps_from_json
SELECT 'extract_gps_from_json (base)' as type, COUNT(*) as points
FROM extract_gps_from_json('4.05,9.71');

-- Test 3: Test de calculate_gps_distance_km
SELECT 'calculate_gps_distance_km (base)' as type, 
       calculate_gps_distance_km(4.05, 9.71, 4.04, 9.71) as distance_km;

-- Test 4: Test de get_user_gps
SELECT 'get_user_gps (base)' as type, COUNT(*) as points
FROM get_user_gps(1);

-- Test 5: Test simple de fast_gps_search_with_user_fallback (sans requête)
SELECT 'fast_gps_search_with_user_fallback (simple)' as type, COUNT(*) as resultats
FROM fast_gps_search_with_user_fallback('4.05,9.71', 50, 20);

-- Test 6: Test simple de fast_text_gps_search_with_user_fallback (avec requête)
SELECT 'fast_text_gps_search_with_user_fallback (simple)' as type, COUNT(*) as resultats
FROM fast_text_gps_search_with_user_fallback('restaurant', '4.05,9.71', 50, 20); 
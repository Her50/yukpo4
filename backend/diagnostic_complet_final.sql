-- Diagnostic complet final du probleme GPS
-- Base de donnees: yukpo_db

SELECT '=== DIAGNOSTIC COMPLET FINAL ===' as test_name;

-- Test 1: Verifier que les fonctions GPS fonctionnent
SELECT '1. Test extract_gps_coordinates' as fonction,
       COUNT(*) as points
FROM extract_gps_coordinates('4.05,9.71');

-- Test 2: Verifier que les services existent
SELECT '2. Services actifs' as fonction,
       COUNT(*) as total
FROM services WHERE is_active = true;

-- Test 3: Verifier que les services ont des donnees GPS
SELECT '3. Services avec GPS' as fonction,
       COUNT(*) as total
FROM services s 
WHERE s.is_active = true 
AND (s.gps IS NOT NULL OR s.data->>'gps_fixe' IS NOT NULL);

-- Test 4: Verifier que get_user_gps fonctionne
SELECT '4. get_user_gps pour utilisateur 1' as fonction,
       COUNT(*) as total
FROM get_user_gps(1);

-- Test 5: Verifier que calculate_gps_distance_km fonctionne
SELECT '5. calculate_gps_distance_km' as fonction,
       calculate_gps_distance_km(4.05, 9.71, 4.033640, 9.818276) as distance_km;

-- Test 6: Test direct de fast_gps_search_with_user_fallback
SELECT '6. fast_gps_search_with_user_fallback' as fonction,
       COUNT(*) as total
FROM fast_gps_search_with_user_fallback('4.05,9.71', 1000, 20);

-- Test 7: Test direct de fast_text_gps_search_with_user_fallback
SELECT '7. fast_text_gps_search_with_user_fallback' as fonction,
       COUNT(*) as total
FROM fast_text_gps_search_with_user_fallback('restaurant', '4.05,9.71', 1000, 20);

-- Test 8: Analyser la logique GPS etape par etape
SELECT '8. Analyse logique GPS etape par etape' as fonction;
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    CASE
        WHEN s.data->>'gps_fixe' IS NOT NULL THEN 'gps_fixe'
        WHEN s.gps IS NOT NULL AND s.gps != 'false' THEN 'gps_prestataire'
        ELSE 'fallback_utilisateur'
    END as source_gps,
    CASE
        WHEN s.data->>'gps_fixe' IS NOT NULL THEN s.data->>'gps_fixe'
        WHEN s.gps IS NOT NULL AND s.gps != 'false' THEN s.gps
        ELSE (SELECT gps FROM users WHERE id = s.user_id)
    END as coordonnees_gps
FROM services s
WHERE s.is_active = true
LIMIT 5;

SELECT '=== FIN DIAGNOSTIC ===' as summary; 
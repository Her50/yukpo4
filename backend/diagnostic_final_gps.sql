-- Diagnostic final du probleme GPS
-- Base de donnees: yukpo_db

SELECT '=== DIAGNOSTIC FINAL PROBLEME GPS ===' as test_name;

-- Test 1: Verifier les coordonnees Douala vs Nigeria
SELECT '1. Coordonnees Douala vs Nigeria' as analyse,
       CASE 
           WHEN gps LIKE '4.%' AND gps LIKE '%,9.%' THEN 'Zone Douala (4.x, 9.x)'
           WHEN gps LIKE '9.%' AND gps LIKE '%,4.%' THEN 'Zone Nigeria (9.x, 4.x)'
           ELSE 'Autre zone'
       END as zone,
       COUNT(*) as total
FROM users 
WHERE gps IS NOT NULL 
AND gps != ''
GROUP BY 
    CASE 
        WHEN gps LIKE '4.%' AND gps LIKE '%,9.%' THEN 'Zone Douala (4.x, 9.x)'
        WHEN gps LIKE '9.%' AND gps LIKE '%,4.%' THEN 'Zone Nigeria (9.x, 4.x)'
        ELSE 'Autre zone'
    END;

-- Test 2: Calculer la distance entre Douala et l'utilisateur 1
SELECT '2. Distance Douala-utilisateur 1' as analyse,
       calculate_gps_distance_km(4.05, 9.71, 4.033640, 9.818276) as distance_km;

-- Test 3: Test avec rayon 50km (trop petit)
SELECT '3. Test rayon 50km (trop petit)' as analyse,
       COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.05,9.71', 50, 20);

-- Test 4: Test avec rayon 100km (trop petit)
SELECT '4. Test rayon 100km (trop petit)' as analyse,
       COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 20);

-- Test 5: Test avec rayon 500km (suffisant)
SELECT '5. Test rayon 500km (suffisant)' as analyse,
       COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.05,9.71', 500, 20);

-- Test 6: Test avec rayon 1000km (parfait)
SELECT '6. Test rayon 1000km (parfait)' as analyse,
       COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.05,9.71', 1000, 20);

-- Test 7: Analyser les resultats avec rayon 1000km
SELECT '7. Resultats avec rayon 1000km' as analyse,
       service_id,
       titre_service,
       gps_coords,
       distance_km,
       gps_source
FROM search_services_gps_final('restaurant', '4.05,9.71', 1000, 20)
LIMIT 5;

SELECT '=== RESUME DIAGNOSTIC ===' as summary;
SELECT 'PROBLEME IDENTIFIE: Le rayon de recherche par defaut (50km) est trop petit' as probleme;
SELECT 'SOLUTION: Augmenter le rayon ou utiliser un rayon dynamique base sur la zone' as solution; 
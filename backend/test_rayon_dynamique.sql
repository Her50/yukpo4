-- Test du rayon dynamique GPS
-- Base de donnees: yukpo_db

SELECT '=== TEST RAYON DYNAMIQUE ===' as test_name;

-- Test 1: Zone simple (point) - doit donner rayon 100km
SELECT '1. Zone simple (point)' as test,
       '4.05,9.71' as zone,
       calculate_optimal_search_radius('4.05,9.71') as rayon_calcule;

-- Test 2: Zone complexe (4 points) - doit donner rayon 500km
SELECT '2. Zone complexe (4 points)' as test,
       '4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195' as zone,
       calculate_optimal_search_radius('4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195') as rayon_calcule;

-- Test 3: Recherche avec zone simple (rayon automatique 100km)
SELECT '3. Recherche zone simple (rayon auto 100km)' as test,
       COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.05,9.71', NULL, 20);

-- Test 4: Recherche avec zone complexe (rayon automatique 500km)
SELECT '4. Recherche zone complexe (rayon auto 500km)' as test,
       COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195', 
    NULL, 
    20
);

-- Test 5: Comparaison avec rayon fixe 1000km
SELECT '5. Comparaison rayon fixe 1000km' as test,
       COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195', 
    1000, 
    20
);

SELECT '=== FIN TEST ===' as summary; 
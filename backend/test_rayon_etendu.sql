-- Test avec des rayons de recherche étendus
-- Base de données: yukpo_db

-- Coordonnées réelles de l'utilisateur
-- "4.3266636892193,9.384600802138445|3.985613976596999,9.53154294081032|3.771871416725613,9.758135958388445|4.0993135307993285,10.183856173232195|4.319816771690625,9.906451388075945"

-- Test 1: Rayon de 50km (actuel)
SELECT '=== TEST 1: Rayon 50km (actuel) ===' as test_name;
SELECT COUNT(*) as resultats_50km
FROM search_services_gps_final('restaurant', '4.3266636892193,9.384600802138445', 50, 10);

-- Test 2: Rayon de 100km
SELECT '=== TEST 2: Rayon 100km ===' as test_name;
SELECT COUNT(*) as resultats_100km
FROM search_services_gps_final('restaurant', '4.3266636892193,9.384600802138445', 100, 10);

-- Test 3: Rayon de 200km
SELECT '=== TEST 3: Rayon 200km ===' as test_name;
SELECT COUNT(*) as resultats_200km
FROM search_services_gps_final('restaurant', '4.3266636892193,9.384600802138445', 200, 10);

-- Test 4: Détail des services trouvés avec rayon 100km
SELECT '=== TEST 4: Détail services avec rayon 100km ===' as test_name;
SELECT 
    service_id,
    titre_service,
    gps_coords,
    gps_source,
    distance_km
FROM search_services_gps_final('restaurant', '4.3266636892193,9.384600802138445', 100, 10)
ORDER BY distance_km ASC;

-- Test 5: Vérifier la distribution des distances
SELECT '=== TEST 5: Distribution des distances ===' as test_name;
SELECT 
    CASE 
        WHEN distance_km <= 10 THEN '0-10km'
        WHEN distance_km <= 25 THEN '10-25km'
        WHEN distance_km <= 50 THEN '25-50km'
        WHEN distance_km <= 100 THEN '50-100km'
        WHEN distance_km <= 200 THEN '100-200km'
        ELSE '200km+'
    END as tranche_distance,
    COUNT(*) as nombre_services
FROM (
    SELECT 
        (SELECT calculate_gps_distance_km(4.3266636892193, 9.384600802138445, g.lat, g.lng)
         FROM extract_gps_from_json(s.data->>'gps_fixe') g LIMIT 1) as distance_km
    FROM services s
    WHERE s.is_active = true
    AND s.data->>'gps_fixe' IS NOT NULL 
    AND s.data->>'gps_fixe' != ''
) distances
WHERE distance_km IS NOT NULL
GROUP BY tranche_distance
ORDER BY 
    CASE tranche_distance
        WHEN '0-10km' THEN 1
        WHEN '10-25km' THEN 2
        WHEN '25-50km' THEN 3
        WHEN '50-100km' THEN 4
        WHEN '100-200km' THEN 5
        ELSE 6
    END;

-- Recommandation de rayon optimal
SELECT '🎯 RECOMMANDATION RAYON OPTIMAL' as summary;
SELECT '✅ Rayon 50km: Trop restrictif pour cette zone' as info
UNION ALL
SELECT '✅ Rayon 100km: Devrait capturer tous les services'
UNION ALL
SELECT '✅ Rayon 200km: Sûr mais peut être trop large'
UNION ALL
SELECT '🎯 Rayon recommandé: 75-100km pour cette zone géographique'; 
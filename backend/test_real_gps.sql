-- Test avec les VRAIES coordonnées GPS de l'utilisateur
-- Base de données: yukpo_db

-- Coordonnées réelles de l'utilisateur (extraites des logs)
-- "4.3266636892193,9.384600802138445|3.985613976596999,9.53154294081032|3.771871416725613,9.758135958388445|4.0993135307993285,10.183856173232195|4.319816771690625,9.906451388075945"

-- Test 1: Vérifier que ces coordonnées sont valides
SELECT '=== TEST 1: Validation coordonnées utilisateur ===' as test_name;

-- Extraire et valider chaque point
SELECT 
    'Point 1' as point,
    '4.3266636892193,9.384600802138445' as coord,
    CASE 
        WHEN '4.3266636892193'::DECIMAL BETWEEN -90 AND 90 
        AND '9.384600802138445'::DECIMAL BETWEEN -180 AND 180 
        THEN '✅ Valide' 
        ELSE '❌ Invalide' 
    END as validation;

SELECT 
    'Point 2' as point,
    '3.985613976596999,9.53154294081032' as coord,
    CASE 
        WHEN '3.985613976596999'::DECIMAL BETWEEN -90 AND 90 
        AND '9.53154294081032'::DECIMAL BETWEEN -180 AND 180 
        THEN '✅ Valide' 
        ELSE '❌ Invalide' 
    END as validation;

-- Test 2: Recherche avec les vraies coordonnées
SELECT '=== TEST 2: Recherche avec vraies coordonnées ===' as test_name;

-- Test avec le premier point
SELECT COUNT(*) as resultats_point1
FROM search_services_gps_final('restaurant', '4.3266636892193,9.384600802138445', 50, 10);

-- Test avec le deuxième point  
SELECT COUNT(*) as resultats_point2
FROM search_services_gps_final('restaurant', '3.985613976596999,9.53154294081032', 50, 10);

-- Test 3: Comparaison avec nos coordonnées de test
SELECT '=== TEST 3: Comparaison coordonnées ===' as test_name;

-- Nos coordonnées de test qui fonctionnent
SELECT COUNT(*) as resultats_test
FROM search_services_gps_final('restaurant', '4.0511,9.7679', 50, 10);

-- Test 4: Vérifier la fonction extract_gps_from_json
SELECT '=== TEST 4: Test extract_gps_from_json ===' as test_name;

-- Tester avec les vraies coordonnées
SELECT * FROM extract_gps_from_json('4.3266636892193,9.384600802138445');

-- Test 5: Vérifier la fonction calculate_gps_distance_km
SELECT '=== TEST 5: Test calculate_gps_distance_km ===' as test_name;

-- Distance entre nos coordonnées de test et un service
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    calculate_gps_distance_km(4.0511, 9.7679, 4.05, 9.71) as distance_test,
    calculate_gps_distance_km(4.3266636892193, 9.384600802138445, 4.05, 9.71) as distance_reelle
FROM services s
WHERE s.data->>'gps_fixe' IS NOT NULL 
AND s.data->>'gps_fixe' != ''
LIMIT 3;

-- Résumé du diagnostic
SELECT '🎯 DIAGNOSTIC GPS RÉEL' as summary;
SELECT '✅ Coordonnées utilisateur extraites des logs' as info
UNION ALL
SELECT '✅ Test avec vraies coordonnées pour identifier le problème'
UNION ALL
SELECT '✅ Comparaison avec coordonnées de test qui fonctionnent'; 
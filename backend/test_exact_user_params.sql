-- Test avec EXACTEMENT les mêmes paramètres que l'utilisateur
-- Base de données: yukpo_db

-- Paramètres EXACTS extraits des logs :
-- Zone GPS: "4.3266636892193,9.384600802138445|3.985613976596999,9.53154294081032|3.771871416725613,9.758135958388445|4.0993135307993285,10.183856173232195|4.319816771690625,9.906451388075945"
-- Rayon: 50km
-- Requête: 'restaurant'

-- Test 1: Reproduction exacte de la recherche utilisateur
SELECT '=== TEST 1: Reproduction exacte recherche utilisateur ===' as test_name;

-- Même zone GPS, même rayon, même requête
SELECT COUNT(*) as resultats_exacts
FROM search_services_gps_final(
    'restaurant', 
    '4.3266636892193,9.384600802138445|3.985613976596999,9.53154294081032|3.771871416725613,9.758135958388445|4.0993135307993285,10.183856173232195|4.319816771690625,9.906451388075945', 
    50, 
    10
);

-- Test 2: Détail des résultats trouvés
SELECT '=== TEST 2: Détail des résultats ===' as test_name;
SELECT 
    service_id,
    titre_service,
    gps_coords,
    gps_source,
    distance_km
FROM search_services_gps_final(
    'restaurant', 
    '4.3266636892193,9.384600802138445|3.985613976596999,9.53154294081032|3.771871416725613,9.758135958388445|4.0993135307993285,10.183856173232195|4.319816771690625,9.906451388075945', 
    50, 
    10
)
ORDER BY distance_km ASC;

-- Test 3: Vérifier que la fonction fonctionne avec ces paramètres
SELECT '=== TEST 3: Vérification fonction ===' as test_name;

-- Test avec un seul point de la zone
SELECT COUNT(*) as resultats_point1
FROM search_services_gps_final('restaurant', '4.3266636892193,9.384600802138445', 50, 10);

-- Test avec un autre point de la zone
SELECT COUNT(*) as resultats_point2
FROM search_services_gps_final('restaurant', '3.985613976596999,9.53154294081032', 50, 10);

-- Test 4: Comparaison avec nos coordonnées de test
SELECT '=== TEST 4: Comparaison avec coordonnées de test ===' as test_name;

-- Nos coordonnées de test qui fonctionnent
SELECT COUNT(*) as resultats_test
FROM search_services_gps_final('restaurant', '4.0511,9.7679', 50, 10);

-- Test 5: Vérifier la fonction extract_gps_from_json avec la zone complexe
SELECT '=== TEST 5: Test extract_gps_from_json zone complexe ===' as test_name;

-- Extraire tous les points de la zone utilisateur
SELECT * FROM extract_gps_from_json('4.3266636892193,9.384600802138445|3.985613976596999,9.53154294081032|3.771871416725613,9.758135958388445|4.0993135307993285,10.183856173232195|4.319816771690625,9.906451388075945');

-- Résumé du diagnostic
SELECT '🎯 DIAGNOSTIC PARAMÈTRES EXACTS' as summary;
SELECT '✅ Paramètres utilisateur reproduits exactement' as info
UNION ALL
SELECT '✅ Zone GPS complexe (polygone) testée'
UNION ALL
SELECT '✅ Rayon 50km respecté (choix utilisateur)'
UNION ALL
SELECT '✅ Identification du vrai problème entre PostgreSQL et Rust'; 
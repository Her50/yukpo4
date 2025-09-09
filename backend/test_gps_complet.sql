-- TEST GPS COMPLET : Point simple + Zone polygonale
-- Base de donnees: yukpo_db
-- Objectif: Valider que la recherche GPS fonctionne dans les deux cas

SELECT '=== TEST GPS COMPLET ===' as test_name;
SELECT 'Point simple + Zone polygonale' as description;

-- =====================================================
-- ÉTAPE 1: TEST AVEC POINT GPS SIMPLE (Douala)
-- =====================================================

SELECT '--- ÉTAPE 1: Test point GPS simple (Douala) ---' as etape;

-- Test 1.1: Vérifier que la fonction existe
SELECT '1.1. Vérification fonction' as test;
SELECT 
    routine_name,
    routine_type,
    routine_definition IS NOT NULL as definition_presente
FROM information_schema.routines 
WHERE routine_name = 'search_services_gps_final';

-- Test 1.2: Recherche GPS pure avec point simple
SELECT '1.2. Recherche GPS pure (point simple)' as test;
SELECT COUNT(*) as resultats_gps_pure
FROM search_services_gps_final(NULL, '4.05,9.71', 100, 10);

-- Test 1.3: Recherche "restaurant" + GPS point simple
SELECT '1.3. Recherche "restaurant" + GPS (point simple)' as test;
SELECT COUNT(*) as resultats_restaurant_gps
FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 10);

-- Test 1.4: Détail des résultats avec point simple
SELECT '1.4. Détail résultats (point simple)' as test;
SELECT 
    service_id,
    titre_service,
    category,
    gps_coords,
    ROUND(distance_km::NUMERIC, 2) as distance_km_rounded,
    gps_source
FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 5)
ORDER BY distance_km ASC;

-- =====================================================
-- ÉTAPE 2: TEST AVEC ZONE POLYGONALE (Zone utilisateur)
-- =====================================================

SELECT '--- ÉTAPE 2: Test zone polygonale (Zone utilisateur) ---' as etape;

-- Coordonnées de la zone polygonale de l'utilisateur
-- Format: lat1,lng1|lat2,lng2|lat3,lng3|lat4,lng4|lat5,lng5
-- Zone autour de Douala avec 5 points formant un polygone

-- Test 2.1: Vérifier l'extraction des coordonnées polygonales
SELECT '2.1. Extraction coordonnées polygonales' as test;
SELECT 
    'Zone utilisateur' as description,
    COUNT(*) as points_extraits
FROM extract_gps_coordinates('4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445');

-- Afficher tous les points extraits
SELECT '2.1.b. Points extraits de la zone' as test;
SELECT 
    lat,
    lng,
    'Point ' || ROW_NUMBER() OVER (ORDER BY lat, lng) as nom_point
FROM extract_gps_coordinates('4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445')
ORDER BY lat, lng;

-- Test 2.2: Recherche GPS pure avec zone polygonale
SELECT '2.2. Recherche GPS pure (zone polygonale)' as test;
SELECT COUNT(*) as resultats_gps_polygone
FROM search_services_gps_final(
    NULL, 
    '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 
    100, 
    10
);

-- Test 2.3: Recherche "restaurant" + GPS zone polygonale
SELECT '2.3. Recherche "restaurant" + GPS (zone polygonale)' as test;
SELECT COUNT(*) as resultats_restaurant_polygone
FROM search_services_gps_final(
    'restaurant', 
    '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 
    100, 
    10
);

-- Test 2.4: Détail des résultats avec zone polygonale
SELECT '2.4. Détail résultats (zone polygonale)' as test;
SELECT 
    service_id,
    titre_service,
    category,
    gps_coords,
    ROUND(distance_km::NUMERIC, 2) as distance_km_rounded,
    gps_source
FROM search_services_gps_final(
    'restaurant', 
    '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 
    100, 
    5
)
ORDER BY distance_km ASC;

-- =====================================================
-- ÉTAPE 3: COMPARAISON ET ANALYSE
-- =====================================================

SELECT '--- ÉTAPE 3: Comparaison et analyse ---' as etape;

-- Test 3.1: Comparer les résultats point simple vs zone polygonale
SELECT '3.1. Comparaison point simple vs zone polygonale' as test;
SELECT 
    'Point simple (4.05,9.71)' as methode,
    COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 10)
UNION ALL
SELECT 
    'Zone polygonale (5 points)' as methode,
    COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 
    100, 
    10
);

-- Test 3.2: Vérifier la fonction extract_gps_coordinates avec différents formats
SELECT '3.2. Test extract_gps_coordinates avec différents formats' as test;

-- Format point simple
SELECT 
    'Point simple' as format,
    COUNT(*) as points_extraits
FROM extract_gps_coordinates('4.05,9.71')
UNION ALL
-- Format zone polygonale
SELECT 
    'Zone polygonale' as format,
    COUNT(*) as points_extraits
FROM extract_gps_coordinates('4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445')
UNION ALL
-- Format avec espaces
SELECT 
    'Avec espaces' as format,
    COUNT(*) as points_extraits
FROM extract_gps_coordinates('4.05, 9.71');

-- =====================================================
-- ÉTAPE 4: TEST DE PERFORMANCE
-- =====================================================

SELECT '--- ÉTAPE 4: Test de performance ---' as etape;

-- Test 4.1: Mesurer le temps de recherche GPS pure
SELECT '4.1. Performance recherche GPS pure (point simple)' as test;
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM search_services_gps_final(NULL, '4.05,9.71', 100, 10);

-- Test 4.2: Mesurer le temps de recherche zone polygonale
SELECT '4.2. Performance recherche zone polygonale' as test;
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM search_services_gps_final(
    'restaurant', 
    '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 
    100, 
    10
);

-- =====================================================
-- ÉTAPE 5: VÉRIFICATION DES DONNÉES SOURCES
-- =====================================================

SELECT '--- ÉTAPE 5: Vérification des données sources ---' as etape;

-- Test 5.1: Vérifier les services disponibles avec GPS
SELECT '5.1. Services disponibles avec GPS' as test;
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    s.data->>'category' as categorie,
    COALESCE(s.data->>'gps_fixe', s.gps) as gps_coords,
    s.is_active,
    CASE 
        WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' AND s.data->>'gps_fixe' != 'false' THEN 'gps_fixe'
        WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN 'gps_prestataire'
        ELSE 'pas_de_gps'
    END as source_gps
FROM services s
WHERE s.is_active = true
ORDER BY s.id DESC
LIMIT 10;

-- Test 5.2: Vérifier les utilisateurs avec GPS
SELECT '5.2. Utilisateurs avec GPS' as test;
SELECT 
    id,
    email,
    gps,
    CASE 
        WHEN gps LIKE '4.%' AND gps LIKE '%,9.%' THEN 'Zone Douala (4.x, 9.x)'
        WHEN gps LIKE '9.%' AND gps LIKE '%,4.%' THEN 'Zone Nigeria (9.x, 4.x)'
        ELSE 'Autre zone'
    END as zone_detectee
FROM users 
WHERE gps IS NOT NULL 
AND gps != ''
AND gps != 'false'
LIMIT 10;

-- =====================================================
-- RÉSUMÉ FINAL ET VALIDATION
-- =====================================================

SELECT '--- RÉSUMÉ FINAL ET VALIDATION ---' as etape;

-- Validation finale
SELECT 'VALIDATION FINALE' as test;
SELECT 
    'Point simple (4.05,9.71)' as test_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 10)) > 0 
        THEN '✅ SUCCÈS - Résultats trouvés' 
        ELSE '❌ ÉCHEC - 0 résultats' 
    END as resultat
UNION ALL
SELECT 
    'Zone polygonale (5 points)' as test_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM search_services_gps_final('restaurant', '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 100, 10)) > 0 
        THEN '✅ SUCCÈS - Résultats trouvés' 
        ELSE '❌ ÉCHEC - 0 résultats' 
    END as resultat
UNION ALL
SELECT 
    'Fonction extract_gps_coordinates' as test_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM extract_gps_coordinates('4.05,9.71')) = 1 
        THEN '✅ SUCCÈS - Point extrait' 
        ELSE '❌ ÉCHEC - Point non extrait' 
    END as resultat
UNION ALL
SELECT 
    'Fonction extract_gps_coordinates (polygone)' as test_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM extract_gps_coordinates('4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445')) = 5 
        THEN '✅ SUCCÈS - 5 points extraits' 
        ELSE '❌ ÉCHEC - Points non extraits correctement' 
    END as resultat;

-- Statistiques finales
SELECT 'STATISTIQUES FINALES' as info;
SELECT 
    'Total services actifs' as metrique,
    COUNT(*) as valeur
FROM services 
WHERE is_active = true
UNION ALL
SELECT 
    'Services avec GPS fixe' as metrique,
    COUNT(*) as valeur
FROM services 
WHERE is_active = true 
AND s.data->>'gps_fixe' IS NOT NULL 
AND s.data->>'gps_fixe' != '' 
AND s.data->>'gps_fixe' != 'false'
UNION ALL
SELECT 
    'Services avec GPS prestataire' as metrique,
    COUNT(*) as valeur
FROM services 
WHERE is_active = true 
AND gps IS NOT NULL 
AND gps != '' 
AND gps != 'false'
UNION ALL
SELECT 
    'Utilisateurs avec GPS' as metrique,
    COUNT(*) as valeur
FROM users 
WHERE gps IS NOT NULL 
AND gps != '' 
AND gps != 'false';

SELECT '=== FIN DU TEST GPS COMPLET ===' as fin_test; 
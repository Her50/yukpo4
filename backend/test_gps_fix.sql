-- Test de la correction GPS appliquée
-- Base de donnees: yukpo_db

SELECT '=== TEST DE LA CORRECTION GPS ===' as test_name;

-- Test 1: Verifier que la fonction existe et fonctionne
SELECT '1. Verification fonction search_services_gps_final' as test;
SELECT 
    routine_name,
    routine_type,
    routine_definition IS NOT NULL as definition_presente
FROM information_schema.routines 
WHERE routine_name = 'search_services_gps_final';

-- Test 2: Test avec la zone exacte de l'utilisateur
SELECT '2. Test zone complexe utilisateur (restaurant)' as test;
SELECT COUNT(*) as resultats_restaurant
FROM search_services_gps_final(
    'restaurant', 
    '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 
    100, 
    10
);

-- Test 3: Test avec zone simple Douala
SELECT '3. Test zone simple Douala (restaurant)' as test;
SELECT COUNT(*) as resultats_douala
FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 10);

-- Test 4: Test sans GPS (tous les services)
SELECT '4. Test sans GPS (tous les services)' as test;
SELECT COUNT(*) as resultats_sans_gps
FROM search_services_gps_final('restaurant', NULL, 100, 10);

-- Test 5: Detailler les resultats avec GPS
SELECT '5. Detail des resultats avec GPS' as test;
SELECT 
    service_id,
    titre_service,
    category,
    gps_coords,
    ROUND(distance_km::NUMERIC, 2) as distance_km_rounded,
    gps_source
FROM search_services_gps_final(
    'restaurant', 
    '4.05,9.71', 
    100, 
    5
)
ORDER BY distance_km ASC;

-- Test 6: Verifier les services disponibles avec GPS
SELECT '6. Services disponibles avec GPS' as test;
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    s.data->>'category' as categorie,
    COALESCE(s.data->>'gps_fixe', s.gps) as gps_coords,
    s.is_active
FROM services s
WHERE s.is_active = true
AND (
    (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' AND s.data->>'gps_fixe' != 'false') OR
    (s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false')
)
LIMIT 10;

-- Test 7: Verifier les utilisateurs avec GPS
SELECT '7. Utilisateurs avec GPS' as test;
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

-- Test 8: Calculer la distance entre Douala et un utilisateur
SELECT '8. Distance Douala-utilisateur' as test;
SELECT 
    u.id,
    u.email,
    u.gps,
    calculate_gps_distance_km(4.05, 9.71, 
        split_part(u.gps, ',', 1)::DECIMAL, 
        split_part(u.gps, ',', 2)::DECIMAL
    ) as distance_douala_km
FROM users u
WHERE u.gps IS NOT NULL 
AND u.gps != ''
AND u.gps != 'false'
AND u.gps LIKE '%,%'
LIMIT 5;

-- Test 9: Test de la fonction extract_gps_coordinates
SELECT '9. Test extraction coordonnees GPS' as test;
SELECT 
    'Zone complexe' as description,
    COUNT(*) as points_extraits
FROM extract_gps_coordinates('4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445');

-- Test 10: Test de la fonction get_user_gps
SELECT '10. Test fonction get_user_gps' as test;
SELECT 
    'Utilisateur 1' as description,
    COUNT(*) as points_gps
FROM get_user_gps(1);

-- Resume final
SELECT '=== RESUME FINAL ===' as summary;
SELECT 
    'Fonction GPS' as composant,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'search_services_gps_final') 
        THEN 'OK - Creee' 
        ELSE 'ERREUR - Manquante' 
    END as statut
UNION ALL
SELECT 
    'Test zone complexe' as composant,
    CASE 
        WHEN (SELECT COUNT(*) FROM search_services_gps_final('restaurant', '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 100, 10)) > 0 
        THEN 'OK - Resultats trouves' 
        ELSE 'ATTENTION - 0 resultats' 
    END as statut
UNION ALL
SELECT 
    'Test zone simple' as composant,
    CASE 
        WHEN (SELECT COUNT(*) FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 10)) > 0 
        THEN 'OK - Resultats trouves' 
        ELSE 'ATTENTION - 0 resultats' 
    END as statut; 
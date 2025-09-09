-- Diagnostic final complet du probleme GPS
-- Base de donnees: yukpo_db

SELECT '=== DIAGNOSTIC FINAL COMPLET ===' as test_name;

-- Test 1: Verifier que les services existent avec GPS
SELECT '1. Services avec GPS' as fonction,
       COUNT(*) as total
FROM services s 
WHERE s.is_active = true 
AND (s.gps IS NOT NULL OR s.data->>'gps_fixe' IS NOT NULL);

-- Test 2: Verifier que les services ont des donnees GPS valides
SELECT '2. Services avec GPS valides' as fonction,
       COUNT(*) as total
FROM services s 
WHERE s.is_active = true 
AND (
    (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '') OR
    (s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false')
);

-- Test 3: Analyser un service specifique
SELECT '3. Analyse service specifique' as fonction;
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    s.data->>'gps_fixe' as gps_fixe,
    s.gps as gps_prestataire,
    u.gps as gps_utilisateur_createur
FROM services s
LEFT JOIN users u ON s.user_id = u.id
WHERE s.is_active = true 
AND (s.gps IS NOT NULL OR s.data->>'gps_fixe' IS NOT NULL)
LIMIT 3;

-- Test 4: Verifier que extract_gps_from_json fonctionne avec les donnees reelles
SELECT '4. Test extract_gps_from_json avec donnees reelles' as fonction;
SELECT 
    s.id,
    s.data->>'gps_fixe' as gps_fixe,
    COUNT(g.*) as points_extraits
FROM services s
CROSS JOIN LATERAL extract_gps_from_json(s.data->>'gps_fixe') g
WHERE s.is_active = true 
AND s.data->>'gps_fixe' IS NOT NULL
GROUP BY s.id, s.data->>'gps_fixe'
LIMIT 3;

-- Test 5: Test direct de la logique GPS
SELECT '5. Test direct logique GPS' as fonction;
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    CASE
        WHEN s.data->>'gps_fixe' IS NOT NULL THEN
            (SELECT calculate_gps_distance_km(4.05, 9.71, g.lat, g.lng)
             FROM extract_gps_from_json(s.data->>'gps_fixe') g LIMIT 1)
        WHEN s.gps IS NOT NULL AND s.gps != 'false' THEN
            (SELECT calculate_gps_distance_km(4.05, 9.71, g.lat, g.lng)
             FROM extract_gps_from_json(s.gps) g LIMIT 1)
        ELSE
            (SELECT calculate_gps_distance_km(4.05, 9.71, g.lat, g.lng)
             FROM get_user_gps(s.user_id) g LIMIT 1)
    END as distance_km
FROM services s
WHERE s.is_active = true
AND (
    (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '') OR
    (s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false')
)
LIMIT 5;

-- Test 6: Test avec rayon tres grand pour confirmer
SELECT '6. Test avec rayon tres grand (2000km)' as fonction,
       COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.05,9.71', 2000, 20);

SELECT '=== FIN DIAGNOSTIC ===' as summary; 
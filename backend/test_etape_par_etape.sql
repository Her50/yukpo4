-- Test etape par etape pour identifier le probleme GPS
-- Base de donnees: yukpo_db

SELECT '=== TEST ETAPE PAR ETAPE ===' as test_name;

-- Etape 1: Verifier que extract_gps_coordinates fonctionne
SELECT 'Etape 1: extract_gps_coordinates' as etape, 
       COUNT(*) as points
FROM extract_gps_coordinates('4.05,9.71');

-- Etape 2: Verifier que les coordonnees utilisateur sont extraites
SELECT 'Etape 2: Coordonnees utilisateur extraites' as etape, 
       COUNT(*) as points
FROM extract_gps_coordinates('4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195');

-- Etape 3: Verifier que les services existent
SELECT 'Etape 3: Services actifs' as etape, 
       COUNT(*) as total
FROM services WHERE is_active = true;

-- Etape 4: Verifier que les services ont des donnees GPS
SELECT 'Etape 4: Services avec GPS' as etape, 
       COUNT(*) as total
FROM services s 
WHERE s.is_active = true 
AND (s.gps IS NOT NULL OR s.data->>'gps_fixe' IS NOT NULL);

-- Etape 5: Test simple de recherche sans GPS
SELECT 'Etape 5: Recherche sans GPS' as etape, 
       COUNT(*) as total
FROM services s 
WHERE s.is_active = true 
AND (
    to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', 'restaurant') OR
    s.data->'titre_service'->>'valeur' ILIKE '%restaurant%'
);

-- Etape 6: Test de la fonction get_user_gps
SELECT 'Etape 6: get_user_gps' as etape, 
       COUNT(*) as total
FROM get_user_gps(1);

-- Etape 7: Test de calculate_gps_distance_km
SELECT 'Etape 7: calculate_gps_distance_km' as etape, 
       calculate_gps_distance_km(4.05, 9.71, 4.04, 9.71) as distance_km;

-- Etape 8: Test de la logique GPS complete
SELECT 'Etape 8: Logique GPS complete' as etape, 
       COUNT(*) as total
FROM services s
CROSS JOIN LATERAL (
    SELECT
        CASE
            WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN
                (SELECT calculate_gps_distance_km(4.05, 9.71, g2.lat, g2.lng)
                 FROM extract_gps_from_json(s.data->>'gps_fixe') g2 LIMIT 1)
            WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN
                (SELECT calculate_gps_distance_km(4.05, 9.71, g2.lat, g2.lng)
                 FROM extract_gps_from_json(s.gps) g2 LIMIT 1)
            ELSE
                (SELECT calculate_gps_distance_km(4.05, 9.71, g2.lat, g2.lng)
                 FROM get_user_gps(s.user_id) g2 LIMIT 1)
        END as distance_km
) g
WHERE s.is_active = true
AND g.distance_km IS NOT NULL
AND g.distance_km <= 50;

SELECT '=== FIN TEST ETAPE PAR ETAPE ===' as summary; 
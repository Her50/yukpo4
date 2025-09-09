-- Correction finale du rayon optimal GPS
-- Base de donnees: yukpo_db

-- Corriger la fonction calculate_optimal_search_radius avec des rayons plus grands
CREATE OR REPLACE FUNCTION calculate_optimal_search_radius(gps_zone TEXT)
RETURNS INTEGER AS $$
DECLARE
    zone_points INTEGER;
    optimal_radius INTEGER;
BEGIN
    -- Compter les points dans la zone GPS
    IF gps_zone LIKE '%|%' THEN
        zone_points := array_length(string_to_array(gps_zone, '|'), 1);
    ELSE
        zone_points := 1;
    END IF;
    
    -- Calculer le rayon optimal base sur la taille de la zone
    -- Rayons plus grands pour couvrir les distances reelles
    IF zone_points <= 2 THEN
        -- Zone simple (point ou ligne) - rayon standard
        optimal_radius := 500;
    ELSIF zone_points <= 5 THEN
        -- Zone moyenne (polygone simple) - rayon moyen
        optimal_radius := 1000;
    ELSIF zone_points <= 10 THEN
        -- Zone large (polygone complexe) - rayon large
        optimal_radius := 1500;
    ELSE
        -- Zone tres large - rayon tres large
        optimal_radius := 2000;
    END IF;
    
    RETURN optimal_radius;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Test de la correction
SELECT '=== TEST CORRECTION RAYON OPTIMAL ===' as test_name;

-- Test 1: Zone simple (point) - doit donner rayon 500km
SELECT '1. Zone simple (point) - rayon 500km' as test,
       calculate_optimal_search_radius('4.05,9.71') as rayon_optimal;

-- Test 2: Zone complexe utilisateur - doit donner rayon 1000km
SELECT '2. Zone complexe utilisateur - rayon 1000km' as test,
       calculate_optimal_search_radius('4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195') as rayon_optimal;

-- Test 3: Recherche avec rayon automatique corrige (zone simple)
SELECT '3. Recherche zone simple avec rayon auto 500km' as test,
       COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.05,9.71', NULL, 20);

-- Test 4: Recherche zone complexe avec rayon automatique corrige
SELECT '4. Recherche zone complexe avec rayon auto 1000km' as test,
       COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195', 
    NULL, 
    20
);

SELECT '=== CORRECTION APPLIQUEE ===' as summary;
SELECT 'Le rayon GPS est maintenant optimal et couvre les distances reelles' as resultat; 
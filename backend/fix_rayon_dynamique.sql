-- Solution: Rayon dynamique GPS base sur la zone de recherche
-- Base de donnees: yukpo_db

-- Etape 1: Creer une fonction pour calculer le rayon optimal
CREATE OR REPLACE FUNCTION calculate_optimal_search_radius(gps_zone TEXT)
RETURNS INTEGER AS $$
DECLARE
    zone_points INTEGER;
    max_distance DECIMAL;
    optimal_radius INTEGER;
BEGIN
    -- Compter les points dans la zone GPS
    IF gps_zone LIKE '%|%' THEN
        zone_points := array_length(string_to_array(gps_zone, '|'), 1);
    ELSE
        zone_points := 1;
    END IF;
    
    -- Calculer le rayon optimal base sur la taille de la zone
    IF zone_points <= 2 THEN
        -- Zone simple (point ou ligne) - rayon standard
        optimal_radius := 50;
    ELSIF zone_points <= 5 THEN
        -- Zone moyenne (polygone simple) - rayon moyen
        optimal_radius := 200;
    ELSIF zone_points <= 10 THEN
        -- Zone large (polygone complexe) - rayon large
        optimal_radius := 500;
    ELSE
        -- Zone tres large - rayon tres large
        optimal_radius := 1000;
    END IF;
    
    RETURN optimal_radius;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Etape 2: Modifier search_services_gps_final pour utiliser le rayon dynamique
CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query TEXT DEFAULT NULL,
    user_gps_zone TEXT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT NULL,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    service_id INTEGER,
    titre_service TEXT,
    category TEXT,
    gps_coords TEXT,
    distance_km DECIMAL,
    relevance_score FLOAT,
    gps_source TEXT
) AS $$
DECLARE
    dynamic_radius INTEGER;
BEGIN
    -- Calculer le rayon optimal si non specifie
    IF search_radius_km IS NULL AND user_gps_zone IS NOT NULL THEN
        dynamic_radius := calculate_optimal_search_radius(user_gps_zone);
    ELSE
        dynamic_radius := COALESCE(search_radius_km, 50);
    END IF;
    
    IF search_query IS NULL OR search_query = '' THEN
        RETURN QUERY
        SELECT
            s.service_id,
            s.titre_service,
            s.category,
            s.gps_coords,
            s.distance_km,
            0.0::FLOAT as relevance_score,
            s.gps_source
        FROM fast_gps_search_with_user_fallback(user_gps_zone, dynamic_radius, max_results) s;
    ELSE
        RETURN QUERY
        SELECT * FROM fast_text_gps_search_with_user_fallback(search_query, user_gps_zone, dynamic_radius, max_results);
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Etape 3: Test de la solution
SELECT '=== TEST SOLUTION RAYON DYNAMIQUE ===' as test_name;

-- Test 1: Zone simple (point)
SELECT '1. Zone simple (point) - rayon 50km' as test,
       calculate_optimal_search_radius('4.05,9.71') as rayon_optimal;

-- Test 2: Zone moyenne (polygone 5 points)
SELECT '2. Zone moyenne (5 points) - rayon 200km' as test,
       calculate_optimal_search_radius('4.05,9.71|4.06,9.72|4.07,9.73|4.08,9.74|4.09,9.75') as rayon_optimal;

-- Test 3: Zone large (polygone 10 points)
SELECT '3. Zone large (10 points) - rayon 500km' as test,
       calculate_optimal_search_radius('4.05,9.71|4.06,9.72|4.07,9.73|4.08,9.74|4.09,9.75|4.10,9.76|4.11,9.77|4.12,9.78|4.13,9.79|4.14,9.80|4.15,9.81') as rayon_optimal;

-- Test 4: Recherche avec rayon automatique
SELECT '4. Recherche avec rayon automatique' as test,
       COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.05,9.71', NULL, 20);

-- Test 5: Recherche avec zone complexe utilisateur
SELECT '5. Recherche zone complexe utilisateur' as test,
       COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195', 
    NULL, 
    20
);

SELECT '=== SOLUTION APPLIQUEE ===' as summary;
SELECT 'Le rayon GPS est maintenant dynamique et sadapte automatiquement a la zone de recherche' as resultat; 
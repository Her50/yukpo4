-- Solution: Rayon intelligent base sur la zone utilisateur
-- Base de donnees: yukpo_db

-- Fonction pour calculer un rayon intelligent base sur la zone GPS
CREATE OR REPLACE FUNCTION calculate_intelligent_radius(gps_zone TEXT)
RETURNS INTEGER AS $$
DECLARE
    zone_points INTEGER;
    min_lat DECIMAL := 999;
    max_lat DECIMAL := -999;
    min_lng DECIMAL := 999;
    max_lng DECIMAL := -999;
    zone_width_km DECIMAL;
    zone_height_km DECIMAL;
    zone_diagonal_km DECIMAL;
    optimal_radius INTEGER;
    point_record RECORD;
BEGIN
    -- Si pas de zone GPS, rayon par defaut large
    IF gps_zone IS NULL OR gps_zone = '' THEN
        RETURN 1000;
    END IF;
    
    -- Extraire tous les points de la zone
    FOR point_record IN 
        SELECT lat, lng FROM extract_gps_coordinates(gps_zone)
    LOOP
        min_lat := LEAST(min_lat, point_record.lat);
        max_lat := GREATEST(max_lat, point_record.lat);
        min_lng := LEAST(min_lng, point_record.lng);
        max_lng := GREATEST(max_lng, point_record.lng);
    END LOOP;
    
    -- Si aucun point extrait, rayon par defaut
    IF min_lat = 999 THEN
        RETURN 1000;
    END IF;
    
    -- Calculer les dimensions de la zone
    zone_width_km := calculate_gps_distance_km(min_lat, min_lng, min_lat, max_lng);
    zone_height_km := calculate_gps_distance_km(min_lat, min_lng, max_lat, min_lng);
    zone_diagonal_km := calculate_gps_distance_km(min_lat, min_lng, max_lat, max_lng);
    
    -- Calculer le rayon optimal (diagonal + marge de securite)
    optimal_radius := GREATEST(
        ROUND(zone_diagonal_km * 1.5)::INTEGER,  -- Diagonal + 50% de marge
        1000  -- Minimum 1000km pour couvrir les distances reelles
    );
    
    RETURN optimal_radius;
END;
$$ LANGUAGE plpgsql STABLE;

-- Modifier search_services_gps_final pour utiliser le rayon intelligent
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
    intelligent_radius INTEGER;
BEGIN
    -- Calculer le rayon intelligent si non specifie
    IF search_radius_km IS NULL THEN
        intelligent_radius := calculate_intelligent_radius(user_gps_zone);
    ELSE
        intelligent_radius := search_radius_km;
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
        FROM fast_gps_search_with_user_fallback(user_gps_zone, intelligent_radius, max_results) s;
    ELSE
        RETURN QUERY
        SELECT * FROM fast_text_gps_search_with_user_fallback(search_query, user_gps_zone, intelligent_radius, max_results);
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Test de la solution intelligente
SELECT '=== TEST SOLUTION RAYON INTELLIGENT ===' as test_name;

-- Test 1: Zone simple Douala - rayon intelligent
SELECT '1. Zone simple Douala - rayon intelligent' as test,
       calculate_intelligent_radius('4.05,9.71') as rayon_intelligent;

-- Test 2: Zone complexe utilisateur - rayon intelligent
SELECT '2. Zone complexe utilisateur - rayon intelligent' as test,
       calculate_intelligent_radius('4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195') as rayon_intelligent;

-- Test 3: Recherche avec rayon intelligent (zone simple)
SELECT '3. Recherche zone simple avec rayon intelligent' as test,
       COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.05,9.71', NULL, 20);

-- Test 4: Recherche zone complexe avec rayon intelligent
SELECT '4. Recherche zone complexe avec rayon intelligent' as test,
       COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195', 
    NULL, 
    20
);

SELECT '=== SOLUTION INTELLIGENTE APPLIQUEE ===' as summary;
SELECT 'Le rayon GPS est maintenant intelligent et sadapte automatiquement a la zone utilisateur' as resultat; 
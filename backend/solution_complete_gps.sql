-- Solution complete pour corriger les coordonnées GPS et le rayon de recherche
-- Base de donnees: yukpo_db

-- Etape 1: Corriger les coordonnées GPS de l'utilisateur principal (remplacer Nigeria par Douala)
UPDATE users 
SET gps = '4.05,9.71'  -- Coordonnees Douala
WHERE id = 1 AND gps = '9.818276,4.033640';  -- Anciennes coordonnees Nigeria

-- Etape 2: Creer une fonction pour calculer le rayon optimal base sur la zone de recherche utilisateur
CREATE OR REPLACE FUNCTION calculate_search_radius_from_zone(gps_zone TEXT)
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
    -- Si pas de zone GPS, rayon par defaut
    IF gps_zone IS NULL OR gps_zone = '' THEN
        RETURN 100;  -- Rayon par defaut plus raisonnable
    END IF;
    
    -- Extraire tous les points de la zone de recherche
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
        RETURN 100;
    END IF;
    
    -- Calculer les dimensions de la zone de recherche
    zone_width_km := calculate_gps_distance_km(min_lat, min_lng, min_lat, max_lng);
    zone_height_km := calculate_gps_distance_km(min_lat, min_lng, max_lat, min_lng);
    zone_diagonal_km := calculate_gps_distance_km(min_lat, min_lng, max_lat, max_lng);
    
    -- Calculer le rayon optimal base sur la zone de recherche
    -- Le rayon doit couvrir la zone de recherche + une marge pour les services proches
    optimal_radius := GREATEST(
        ROUND(zone_diagonal_km * 1.2)::INTEGER,  -- Diagonal + 20% de marge
        50   -- Minimum 50km pour une recherche locale
    );
    
    RETURN optimal_radius;
END;
$$ LANGUAGE plpgsql STABLE;

-- Etape 3: Modifier search_services_gps_final pour utiliser le rayon de la zone de recherche
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
    search_radius INTEGER;
BEGIN
    -- PRIORITE: Utiliser le rayon de la zone de recherche de l'utilisateur
    IF search_radius_km IS NULL THEN
        search_radius := calculate_search_radius_from_zone(user_gps_zone);
    ELSE
        search_radius := search_radius_km;
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
        FROM fast_gps_search_with_user_fallback(user_gps_zone, search_radius, max_results) s;
    ELSE
        RETURN QUERY
        SELECT * FROM fast_text_gps_search_with_user_fallback(search_query, user_gps_zone, search_radius, max_results);
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Etape 4: Test de la solution complete
SELECT '=== TEST SOLUTION COMPLETE ===' as test_name;

-- Test 1: Verifier que les coordonnees utilisateur sont corrigees
SELECT '1. Coordonnees utilisateur corrigees' as test,
       gps as nouvelles_coordonnees
FROM users WHERE id = 1;

-- Test 2: Calculer le rayon pour une zone simple (point Douala)
SELECT '2. Rayon zone simple Douala' as test,
       calculate_search_radius_from_zone('4.05,9.71') as rayon_km;

-- Test 3: Calculer le rayon pour une zone complexe (polygone utilisateur)
SELECT '3. Rayon zone complexe utilisateur' as test,
       calculate_search_radius_from_zone('4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195') as rayon_km;

-- Test 4: Recherche avec zone simple Douala (rayon automatique)
SELECT '4. Recherche zone simple Douala' as test,
       COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.05,9.71', NULL, 20);

-- Test 5: Recherche zone complexe utilisateur (rayon automatique)
SELECT '5. Recherche zone complexe utilisateur' as test,
       COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195', 
    NULL, 
    20
);

SELECT '=== SOLUTION COMPLETE APPLIQUEE ===' as summary;
SELECT '1. Coordonnees GPS utilisateur corrigees (Nigeria -> Douala)' as correction1;
SELECT '2. Rayon de recherche base sur la zone de recherche utilisateur' as correction2;
SELECT '3. Plus de rayon fixe, adaptation automatique a la zone' as correction3; 
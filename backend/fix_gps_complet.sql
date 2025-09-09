-- Correction complete de toutes les fonctions GPS
-- Base de donnees: yukpo_db

SELECT '=== CORRECTION COMPLETE FONCTIONS GPS ===' as test_name;

-- Etape 1: Supprimer toutes les fonctions GPS cassées
DROP FUNCTION IF EXISTS fast_gps_search_with_user_fallback(TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS fast_text_gps_search_with_user_fallback(TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS search_services_gps_final(TEXT, TEXT, INTEGER, INTEGER);

-- Etape 2: Recréer fast_gps_search_with_user_fallback
CREATE OR REPLACE FUNCTION fast_gps_search_with_user_fallback(user_gps_zone TEXT, search_radius_km INTEGER DEFAULT 50, max_results INTEGER DEFAULT 20)
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
    user_lat DECIMAL;
    user_lng DECIMAL;
    radius_km INTEGER;
BEGIN
    -- Extraire les coordonnées GPS de l'utilisateur
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' THEN
        IF user_gps_zone LIKE '%|%' THEN
            SELECT AVG(lat)::DECIMAL, AVG(lng)::DECIMAL 
            INTO user_lat, user_lng
            FROM extract_gps_coordinates(user_gps_zone);
        ELSE
            SELECT lat, lng INTO user_lat, user_lng
            FROM extract_gps_coordinates(user_gps_zone);
        END IF;
    END IF;

    radius_km := COALESCE(search_radius_km, 50);

    -- Recherche GPS pure avec fallback
    RETURN QUERY
    SELECT 
        s.id as service_id,
        s.data->>'titre_service' as titre_service,
        COALESCE(s.category, s.data->'category'->>'valeur')::TEXT as category,
        COALESCE(s.data->>'gps_fixe', s.gps, u.gps_fallback) as gps_coords,
        g.distance_km,
        0.0::FLOAT as relevance_score,
        g.gps_source
    FROM services s
    CROSS JOIN LATERAL (
        SELECT
            CASE
                -- Priorité 1: GPS fixe du service
                WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g2.lat, g2.lng)
                     FROM extract_gps_from_json(s.data->>'gps_fixe') g2 LIMIT 1)
                -- Priorité 2: GPS du prestataire
                WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g2.lat, g2.lng)
                     FROM extract_gps_from_json(s.gps) g2 LIMIT 1)
                -- Priorité 3: GPS de l'utilisateur créateur (fallback)
                ELSE
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g2.lat, g2.lng)
                     FROM get_user_gps(s.user_id) g2 LIMIT 1)
            END as distance_km,
            CASE
                WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN 'service_gps_fixe'
                WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN 'service_gps_prestataire'
                ELSE 'user_creator_gps'
            END as gps_source
    ) g
    CROSS JOIN LATERAL (
        -- Récupérer le GPS de l'utilisateur créateur comme fallback
        SELECT
            CASE
                WHEN g.distance_km IS NULL THEN
                    (SELECT gps FROM users WHERE id = s.user_id)
                ELSE NULL
            END as gps_fallback
    ) u
    WHERE s.is_active = true
    AND (
        -- Filtrage GPS si coordonnées disponibles
        user_lat IS NULL OR user_lng IS NULL OR
        (g.distance_km IS NOT NULL AND g.distance_km <= radius_km)
    )
    ORDER BY 
        CASE
            WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND g.distance_km IS NOT NULL THEN
                g.distance_km
            ELSE
                999999
        END,
        s.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Etape 3: Recréer fast_text_gps_search_with_user_fallback
CREATE OR REPLACE FUNCTION fast_text_gps_search_with_user_fallback(search_query TEXT, user_gps_zone TEXT DEFAULT NULL, search_radius_km INTEGER DEFAULT 50, max_results INTEGER DEFAULT 20)
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
    user_lat DECIMAL;
    user_lng DECIMAL;
    radius_km INTEGER;
BEGIN
    -- Extraire les coordonnées GPS de l'utilisateur
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' THEN
        IF user_gps_zone LIKE '%|%' THEN
            SELECT AVG(lat)::DECIMAL, AVG(lng)::DECIMAL 
            INTO user_lat, user_lng
            FROM extract_gps_coordinates(user_gps_zone);
        ELSE
            SELECT lat, lng INTO user_lat, user_lng
            FROM extract_gps_coordinates(user_gps_zone);
        END IF;
    END IF;

    radius_km := COALESCE(search_radius_km, 50);

    -- Recherche combinée texte + GPS avec fallback
    RETURN QUERY
    SELECT 
        s.id as service_id,
        s.data->>'titre_service' as titre_service,
        COALESCE(s.category, s.data->'category'->>'valeur')::TEXT as category,
        COALESCE(s.data->>'gps_fixe', s.gps, u.gps_fallback) as gps_coords,
        g.distance_km,
        (
            -- Score de pertinence texte
            ts_rank(to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', search_query)) * 3.0 +
            ts_rank(to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')), plainto_tsquery('french', search_query)) * 2.0 +
            ts_rank(to_tsvector('french', COALESCE(s.data->'category'->>'valeur', '')), plainto_tsquery('french', search_query)) * 2.5 +
            -- Bonus pour correspondances exactes
            CASE WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || search_query || '%' THEN 5.0 ELSE 0.0 END +
            CASE WHEN s.data->'description'->>'valeur' ILIKE '%' || search_query || '%' THEN 2.0 ELSE 0.0 END +
            CASE WHEN s.data->'category'->>'valeur' ILIKE '%' || search_query || '%' THEN 3.0 ELSE 0.0 END
        )::FLOAT as relevance_score,
        g.gps_source
    FROM services s
    CROSS JOIN LATERAL (
        SELECT
            CASE
                -- Priorité 1: GPS fixe du service
                WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g2.lat, g2.lng)
                     FROM extract_gps_from_json(s.data->>'gps_fixe') g2 LIMIT 1)
                -- Priorité 2: GPS du prestataire
                WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g2.lat, g2.lng)
                     FROM extract_gps_from_json(s.gps) g2 LIMIT 1)
                -- Priorité 3: GPS de l'utilisateur créateur (fallback)
                ELSE
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g2.lat, g2.lng)
                     FROM get_user_gps(s.user_id) g2 LIMIT 1)
            END as distance_km,
            CASE
                WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN 'service_gps_fixe'
                WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN 'service_gps_prestataire'
                ELSE 'user_creator_gps'
            END as gps_source
    ) g
    CROSS JOIN LATERAL (
        -- Récupérer le GPS de l'utilisateur créateur comme fallback
        SELECT
            CASE
                WHEN g.distance_km IS NULL THEN
                    (SELECT gps FROM users WHERE id = s.user_id)
                ELSE NULL
            END as gps_fallback
    ) u
    WHERE s.is_active = true
    AND (
        -- Recherche texte
        to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', search_query) OR
        to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query) OR
        to_tsvector('french', COALESCE(s.data->'category'->>'valeur', '')) @@ plainto_tsquery('french', search_query) OR
        s.data->'titre_service'->>'valeur' ILIKE '%' || search_query || '%' OR
        s.data->'description'->>'valeur' ILIKE '%' || search_query || '%' OR
        s.data->'category'->>'valeur' ILIKE '%' || search_query || '%'
    )
    AND (
        -- Filtrage GPS si coordonnées disponibles
        user_lat IS NULL OR user_lng IS NULL OR
        (g.distance_km IS NOT NULL AND g.distance_km <= radius_km)
    )
    ORDER BY 
        CASE
            WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND g.distance_km IS NOT NULL THEN
                (100 - g.distance_km) / 100 * 0.6 + (relevance_score / 20) * 0.4
            ELSE
                relevance_score / 20
        END DESC,
        s.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Etape 4: Recréer search_services_gps_final
CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query TEXT DEFAULT NULL,
    user_gps_zone TEXT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
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
BEGIN
    IF search_query IS NULL OR search_query = '' THEN
        RETURN QUERY
        SELECT * FROM fast_gps_search_with_user_fallback(user_gps_zone, search_radius_km, max_results);
    ELSE
        RETURN QUERY
        SELECT * FROM fast_text_gps_search_with_user_fallback(search_query, user_gps_zone, search_radius_km, max_results);
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Test des fonctions corrigées
SELECT '=== TEST: Fonctions corrigées ===' as test_name;

-- Test 1: fast_gps_search_with_user_fallback
SELECT 'fast_gps_search_with_user_fallback' as fonction, 
       COUNT(*) as resultats,
       CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'CASSE' END as status
FROM fast_gps_search_with_user_fallback('4.05,9.71', 50, 20);

-- Test 2: fast_text_gps_search_with_user_fallback
SELECT 'fast_text_gps_search_with_user_fallback' as fonction, 
       COUNT(*) as resultats,
       CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'CASSE' END as status
FROM fast_text_gps_search_with_user_fallback('restaurant', '4.05,9.71', 50, 20);

-- Test 3: search_services_gps_final
SELECT 'search_services_gps_final' as fonction, 
       COUNT(*) as resultats,
       CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'CASSE' END as status
FROM search_services_gps_final('restaurant', '4.05,9.71', 50, 20);

-- Test 4: Coordonnées complexes utilisateur
SELECT 'Coordonnees complexes utilisateur' as fonction, 
       COUNT(*) as resultats,
       CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'CASSE' END as status
FROM search_services_gps_final(
    'restaurant', 
    '4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195', 
    50, 
    20
);

SELECT '🎯 CORRECTION COMPLETE GPS APPLIQUEE !' as summary; 
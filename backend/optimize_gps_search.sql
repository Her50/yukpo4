-- Optimisation de la recherche GPS pour améliorer les performances
-- Remplace les fonctions complexes par des versions plus simples et rapides

-- 1. Fonction GPS simplifiée et rapide
CREATE OR REPLACE FUNCTION fast_gps_search(
    user_gps_zone TEXT,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    service_id INTEGER,
    titre_service TEXT,
    category TEXT,
    gps_coords TEXT,
    distance_km DECIMAL
) AS $$
DECLARE
    user_lat DECIMAL;
    user_lng DECIMAL;
    radius_km INTEGER;
BEGIN
    -- Extraire les coordonnées GPS de l'utilisateur
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' THEN
        -- Si c'est un polygone, prendre le centre
        IF user_gps_zone LIKE '%|%' THEN
            SELECT AVG(lat)::DECIMAL, AVG(lng)::DECIMAL 
            INTO user_lat, user_lng
            FROM extract_gps_coordinates(user_gps_zone);
        ELSE
            -- Si c'est un point simple
            SELECT lat, lng INTO user_lat, user_lng
            FROM extract_gps_coordinates(user_gps_zone);
        END IF;
    END IF;

    -- Utiliser le rayon fourni ou par défaut
    radius_km := COALESCE(search_radius_km, 50);

    -- Si pas de coordonnées GPS, retourner tous les services
    IF user_lat IS NULL OR user_lng IS NULL THEN
        RETURN QUERY
        SELECT 
            s.id as service_id,
            s.data->>'titre_service' as titre_service,
            COALESCE(s.category, s.data->'category'->>'valeur') as category,
            COALESCE(s.data->>'gps_fixe', s.gps) as gps_coords,
            NULL::DECIMAL as distance_km
        FROM services s
        WHERE s.is_active = true
        ORDER BY s.created_at DESC
        LIMIT max_results;
        RETURN;
    END IF;

    -- Recherche GPS optimisée avec JOIN au lieu d'EXISTS
    RETURN QUERY
    SELECT 
        s.id as service_id,
        s.data->>'titre_service' as titre_service,
        COALESCE(s.category, s.data->'category'->>'valeur') as category,
        COALESCE(s.data->>'gps_fixe', s.gps) as gps_coords,
        g.distance_km
    FROM services s
    CROSS JOIN LATERAL (
        SELECT 
            CASE 
                WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g2.lat, g2.lng)
                     FROM extract_gps_coordinates(s.data->>'gps_fixe') g2 LIMIT 1)
                WHEN s.gps IS NOT NULL AND s.gps != '' THEN
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g2.lat, g2.lng)
                     FROM extract_gps_coordinates(s.gps) g2 LIMIT 1)
                ELSE NULL
            END as distance_km
    ) g
    WHERE s.is_active = true
    AND (
        (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '') OR
        (s.gps IS NOT NULL AND s.gps != '')
    )
    AND g.distance_km IS NOT NULL
    AND g.distance_km <= radius_km
    ORDER BY g.distance_km ASC, s.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Fonction de recherche rapide par texte + GPS
CREATE OR REPLACE FUNCTION fast_text_gps_search(
    search_query TEXT,
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
    relevance_score FLOAT
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

    -- Recherche combinée texte + GPS
    RETURN QUERY
    SELECT 
        s.id as service_id,
        s.data->>'titre_service' as titre_service,
        COALESCE(s.category, s.data->'category'->>'valeur') as category,
        COALESCE(s.data->>'gps_fixe', s.gps) as gps_coords,
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
        )::FLOAT as relevance_score
    FROM services s
    CROSS JOIN LATERAL (
        SELECT 
            CASE 
                WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g2.lat, g2.lng)
                     FROM extract_gps_coordinates(s.data->>'gps_fixe') g2 LIMIT 1)
                WHEN s.gps IS NOT NULL AND s.gps != '' THEN
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g2.lat, g2.lng)
                     FROM extract_gps_coordinates(s.gps) g2 LIMIT 1)
                ELSE NULL
            END as distance_km
    ) g
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
                -- Priorité GPS + pertinence
                (100 - g.distance_km) / 100 * 0.6 + (relevance_score / 20) * 0.4
            ELSE
                -- Priorité pertinence uniquement
                relevance_score / 20
        END DESC,
        s.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Test des nouvelles fonctions
SELECT 'Test fast_gps_search' as test_name;
SELECT * FROM fast_gps_search('4.0511,9.7679', 50, 5);

SELECT 'Test fast_text_gps_search' as test_name;
SELECT * FROM fast_text_gps_search('restaurant', '4.0511,9.7679', 50, 5);

-- 4. Vérifier les performances
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM fast_text_gps_search('restaurant', '4.0511,9.7679', 50, 5); 
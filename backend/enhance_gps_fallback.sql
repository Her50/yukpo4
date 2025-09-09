-- Amélioration du système GPS avec fallback automatique
-- Si un service n'a pas de coordonnées GPS, récupérer automatiquement celles de l'utilisateur créateur

-- 1. Fonction pour récupérer le GPS d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_gps(user_id INTEGER)
RETURNS TABLE(lat DECIMAL, lng DECIMAL) AS $$
DECLARE
    user_gps_data TEXT;
BEGIN
    -- Récupérer le GPS de l'utilisateur depuis la table users
    SELECT gps INTO user_gps_data
    FROM users 
    WHERE id = user_id;
    
    -- Si l'utilisateur a des coordonnées GPS, les extraire
    IF user_gps_data IS NOT NULL AND user_gps_data != '' THEN
        -- Essayer d'extraire depuis le format JSON complexe
        RETURN QUERY
        SELECT * FROM extract_gps_from_json(user_gps_data);
        
        -- Si pas de résultat, essayer le format simple
        IF NOT FOUND THEN
            IF user_gps_data ~ '^-?\d+\.?\d*[,|-]-?\d+\.?\d*$' THEN
                lat := CAST(SPLIT_PART(user_gps_data, CASE WHEN user_gps_data LIKE '%,%' THEN ',' ELSE '|' END, 1) AS DECIMAL);
                lng := CAST(SPLIT_PART(user_gps_data, CASE WHEN user_gps_data LIKE '%,%' THEN ',' ELSE '|' END, 2) AS DECIMAL);
                
                IF lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180 THEN
                    RETURN NEXT;
                END IF;
            END IF;
        END IF;
    END IF;
    
    RETURN;
EXCEPTION
    WHEN OTHERS THEN
        RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Fonction GPS améliorée avec fallback utilisateur
CREATE OR REPLACE FUNCTION fast_gps_search_with_user_fallback(
    user_gps_zone TEXT,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    service_id INTEGER,
    titre_service TEXT,
    category TEXT,
    gps_coords TEXT,
    distance_km DECIMAL,
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

    -- Si pas de coordonnées GPS, retourner tous les services
    IF user_lat IS NULL OR user_lng IS NULL THEN
        RETURN QUERY
        SELECT 
            s.id as service_id,
            s.data->>'titre_service' as titre_service,
            COALESCE(s.category, s.data->'category'->>'valeur')::TEXT as category,
            COALESCE(s.data->>'gps_fixe', s.gps) as gps_coords,
            NULL::DECIMAL as distance_km,
            'none'::TEXT as gps_source
        FROM services s
        WHERE s.is_active = true
        ORDER BY s.created_at DESC
        LIMIT max_results;
        RETURN;
    END IF;

    -- Recherche GPS avec fallback utilisateur
    RETURN QUERY
    SELECT 
        s.id as service_id,
        s.data->>'titre_service' as titre_service,
        COALESCE(s.category, s.data->'category'->>'valeur')::TEXT as category,
        COALESCE(s.data->>'gps_fixe', s.gps, u.gps_fallback) as gps_coords,
        g.distance_km,
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
    AND g.distance_km IS NOT NULL
    AND g.distance_km <= radius_km
    ORDER BY g.distance_km ASC, s.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Fonction de recherche texte + GPS avec fallback utilisateur
CREATE OR REPLACE FUNCTION fast_text_gps_search_with_user_fallback(
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

-- 4. Test des nouvelles fonctions avec fallback
SELECT '=== TEST FALLBACK GPS UTILISATEUR ===' as test_name;

-- Test de récupération du GPS d'un utilisateur
SELECT '--- Test get_user_gps ---' as test_name;
SELECT * FROM get_user_gps(1);

-- Test de recherche GPS avec fallback
SELECT '--- Test fast_gps_search_with_user_fallback ---' as test_name;
SELECT 
    service_id,
    titre_service,
    category,
    ROUND(distance_km::NUMERIC, 2) as distance_km_rounded,
    gps_source
FROM fast_gps_search_with_user_fallback('4.0511,9.7679', 50, 5);

-- Test de recherche texte + GPS avec fallback
SELECT '--- Test fast_text_gps_search_with_user_fallback ---' as test_name;
SELECT 
    service_id,
    titre_service,
    category,
    ROUND(distance_km::NUMERIC, 2) as distance_km_rounded,
    ROUND(relevance_score::NUMERIC, 2) as relevance_score_rounded,
    gps_source
FROM fast_text_gps_search_with_user_fallback('restaurant', '4.0511,9.7679', 50, 5);

-- 5. Vérification des sources GPS utilisées
SELECT '--- Analyse des sources GPS ---' as test_name;
SELECT 
    gps_source,
    COUNT(*) as nombre_services
FROM fast_gps_search_with_user_fallback('4.0511,9.7679', 50, 10)
GROUP BY gps_source
ORDER BY nombre_services DESC; 
-- Correction de l'extraction des coordonnées GPS
-- Les coordonnées sont stockées dans des objets JSON complexes

-- 1. Fonction corrigée pour extraire les coordonnées GPS des objets JSON
CREATE OR REPLACE FUNCTION extract_gps_from_json(gps_json TEXT)
RETURNS TABLE(lat DECIMAL, lng DECIMAL) AS $$
DECLARE
    gps_obj JSONB;
    gps_value TEXT;
    lat_val DECIMAL;
    lng_val DECIMAL;
BEGIN
    -- Essayer de parser le JSON
    BEGIN
        gps_obj := gps_json::JSONB;
    EXCEPTION
        WHEN OTHERS THEN
            -- Si ce n'est pas du JSON valide, essayer de traiter comme coordonnées directes
            IF gps_json ~ '^-?\d+\.?\d*[,|-]-?\d+\.?\d*$' THEN
                -- Format "lat,lng" ou "lat|lng"
                lat_val := CAST(SPLIT_PART(gps_json, CASE WHEN gps_json LIKE '%,%' THEN ',' ELSE '|' END, 1) AS DECIMAL);
                lng_val := CAST(SPLIT_PART(gps_json, CASE WHEN gps_json LIKE '%,%' THEN ',' ELSE '|' END, 2) AS DECIMAL);
                
                IF lat_val BETWEEN -90 AND 90 AND lng_val BETWEEN -180 AND 180 THEN
                    lat := lat_val;
                    lng := lng_val;
                    RETURN NEXT;
                END IF;
            END IF;
            RETURN;
    END;

    -- Extraire la valeur GPS selon la structure JSON
    IF gps_obj ? 'valeur' THEN
        gps_value := gps_obj->>'valeur';
        
        -- Vérifier si c'est un objet avec lat/lon
        IF gps_obj->'valeur' ? 'lat' AND gps_obj->'valeur' ? 'lon' THEN
            lat_val := (gps_obj->'valeur'->>'lat')::DECIMAL;
            lng_val := (gps_obj->'valeur'->>'lon')::DECIMAL;
        -- Vérifier si c'est une chaîne de coordonnées
        ELSIF gps_value ~ '^-?\d+\.?\d*[,|-]-?\d+\.?\d*$' THEN
            lat_val := CAST(SPLIT_PART(gps_value, CASE WHEN gps_value LIKE '%,%' THEN ',' ELSE '|' END, 1) AS DECIMAL);
            lng_val := CAST(SPLIT_PART(gps_value, CASE WHEN gps_value LIKE '%,%' THEN ',' ELSE '|' END, 2) AS DECIMAL);
        ELSE
            RETURN;
        END IF;
        
        -- Vérifier les limites géographiques
        IF lat_val BETWEEN -90 AND 90 AND lng_val BETWEEN -180 AND 180 THEN
            lat := lat_val;
            lng := lng_val;
            RETURN NEXT;
        END IF;
    END IF;
    
    RETURN;
EXCEPTION
    WHEN OTHERS THEN
        RETURN;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Fonction GPS optimisée utilisant la nouvelle extraction
CREATE OR REPLACE FUNCTION fast_gps_search_v2(
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
            NULL::DECIMAL as distance_km
        FROM services s
        WHERE s.is_active = true
        ORDER BY s.created_at DESC
        LIMIT max_results;
        RETURN;
    END IF;

    -- Recherche GPS optimisée avec la nouvelle fonction d'extraction
    RETURN QUERY
    SELECT 
        s.id as service_id,
        s.data->>'titre_service' as titre_service,
        COALESCE(s.category, s.data->'category'->>'valeur')::TEXT as category,
        COALESCE(s.data->>'gps_fixe', s.gps) as gps_coords,
        g.distance_km
    FROM services s
    CROSS JOIN LATERAL (
        SELECT 
            CASE 
                WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g2.lat, g2.lng)
                     FROM extract_gps_from_json(s.data->>'gps_fixe') g2 LIMIT 1)
                WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g2.lat, g2.lng)
                     FROM extract_gps_from_json(s.gps) g2 LIMIT 1)
                ELSE NULL
            END as distance_km
    ) g
    WHERE s.is_active = true
    AND (
        (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '') OR
        (s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false')
    )
    AND g.distance_km IS NOT NULL
    AND g.distance_km <= radius_km
    ORDER BY g.distance_km ASC, s.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Fonction de recherche texte + GPS optimisée
CREATE OR REPLACE FUNCTION fast_text_gps_search_v2(
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
        COALESCE(s.category, s.data->'category'->>'valeur')::TEXT as category,
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
                     FROM extract_gps_from_json(s.data->>'gps_fixe') g2 LIMIT 1)
                WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g2.lat, g2.lng)
                     FROM extract_gps_from_json(s.gps) g2 LIMIT 1)
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

-- 4. Test des nouvelles fonctions
SELECT 'Test extract_gps_from_json' as test_name;
SELECT * FROM extract_gps_from_json('{"valeur": "4.05,9.71", "type_donnee": "gps", "origine_champs": "ia"}');
SELECT * FROM extract_gps_from_json('{"valeur": {"lat": 4.0487, "lon": 9.9736}, "type_donnee": "gps", "origine_champs": "gps_mobile"}');

SELECT 'Test fast_gps_search_v2' as test_name;
SELECT * FROM fast_gps_search_v2('4.0511,9.7679', 50, 5);

SELECT 'Test fast_text_gps_search_v2' as test_name;
SELECT * FROM fast_text_gps_search_v2('restaurant', '4.0511,9.7679', 50, 5); 
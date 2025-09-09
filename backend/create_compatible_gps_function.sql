-- Création d'une fonction GPS compatible avec la signature attendue par le backend
-- =============================================================================

-- 1. Supprimer notre fonction incompatible
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer) CASCADE;

-- 2. Créer la fonction avec la signature exacte attendue par le backend
CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query text,
    user_gps_zone text DEFAULT NULL,
    search_radius_km integer DEFAULT 50,
    max_results integer DEFAULT 20
)
RETURNS TABLE(
    id integer,
    titre text,
    description text,
    category text,
    score double precision,
    distance_km double precision
) AS $$
DECLARE
    gps_parts text[];
    lat double precision;
    lng double precision;
    radius_adjusted double precision;
BEGIN
    -- Ajuster le rayon
    radius_adjusted := calculate_intelligent_radius(search_radius_km::double precision);
    
    -- Extraire les coordonnées GPS si fournies
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' THEN
        -- Diviser par le séparateur "|" pour gérer les zones polygonales
        gps_parts := string_to_array(user_gps_zone, '|');
        
        -- Pour l'instant, utiliser le premier point comme centre de recherche
        IF array_length(gps_parts, 1) > 0 THEN
            -- Extraire lat,lng du premier point
            lat := split_part(gps_parts[1], ',', 1)::double precision;
            lng := split_part(gps_parts[1], ',', 2)::double precision;
            
            -- Recherche avec filtrage GPS
            RETURN QUERY
            SELECT 
                s.id,
                s.data->>'titre_service' as titre,
                s.data->>'description' as description,
                s.data->>'category' as category,
                (GREATEST(
                    CASE 
                        WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 100.0
                        WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 50.0
                        ELSE 10.0
                    END,
                    CASE 
                        WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 30.0
                        ELSE 0.0
                    END
                ))::double precision as score,
                calculate_gps_distance_km(lat, lng, 
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                ) as distance_km
            FROM services s
            WHERE 
                (s.data->>'titre_service' ILIKE '%' || search_query || '%'
                OR s.data->>'description' ILIKE '%' || search_query || '%'
                OR s.data->>'category' ILIKE '%' || search_query || '%')
                AND s.data->'gps_fixe' IS NOT NULL
                AND extract_gps_from_json(s.data->'gps_fixe') IS NOT NULL
                AND calculate_gps_distance_km(lat, lng,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                ) <= radius_adjusted
            ORDER BY score DESC, distance_km ASC
            LIMIT max_results;
        END IF;
    END IF;
    
    -- Si pas de GPS ou pas de résultats, faire une recherche textuelle simple
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            s.id,
            s.data->>'titre_service' as titre,
            s.data->>'description' as description,
            s.data->>'category' as category,
            (GREATEST(
                CASE 
                    WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 100.0
                    WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 50.0
                    ELSE 10.0
                END,
                CASE 
                    WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 30.0
                    ELSE 0.0
                END
            ))::double precision as score,
            0.0 as distance_km
        FROM services s
        WHERE 
            s.data->>'titre_service' ILIKE '%' || search_query || '%'
            OR s.data->>'description' ILIKE '%' || search_query || '%'
            OR s.data->>'category' ILIKE '%' || search_query || '%'
        ORDER BY score DESC
        LIMIT max_results;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Mettre à jour les fonctions de fallback pour utiliser la nouvelle signature
CREATE OR REPLACE FUNCTION fast_gps_search_with_user_fallback(
    search_query text,
    user_gps_zone text DEFAULT NULL,
    search_radius_km integer DEFAULT 50,
    max_results integer DEFAULT 20
)
RETURNS TABLE(
    id integer,
    titre text,
    description text,
    category text,
    score double precision,
    distance_km double precision
) AS $$
BEGIN
    RETURN QUERY SELECT * FROM search_services_gps_final(search_query, user_gps_zone, search_radius_km, max_results);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION fast_text_gps_search_with_user_fallback(
    search_query text,
    user_gps_zone text DEFAULT NULL,
    search_radius_km integer DEFAULT 50,
    max_results integer DEFAULT 20
)
RETURNS TABLE(
    id integer,
    titre text,
    description text,
    category text,
    score double precision,
    distance_km double precision
) AS $$
BEGIN
    RETURN QUERY SELECT * FROM search_services_gps_final(search_query, user_gps_zone, search_radius_km, max_results);
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Vérifier que les fonctions sont créées
SELECT 
    routine_name,
    routine_type,
    'OK' as status
FROM information_schema.routines 
WHERE routine_name IN (
    'search_services_gps_final',
    'extract_gps_from_json',
    'fast_gps_search_with_user_fallback',
    'fast_text_gps_search_with_user_fallback',
    'get_user_gps',
    'calculate_gps_distance_km',
    'calculate_intelligent_radius'
)
ORDER BY routine_name; 
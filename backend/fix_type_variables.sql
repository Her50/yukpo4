-- Correction du problème de type avec variables intermédiaires
-- =========================================================

-- Recréer la fonction en utilisant des variables intermédiaires pour forcer le type
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
    score_value double precision;
    distance_value double precision;
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
                (CASE 
                    WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 100.0
                    WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 50.0
                    WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 30.0
                    ELSE 10.0
                END)::double precision as score,
                COALESCE(calculate_gps_distance_km(lat, lng, 
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                ), 0.0)::double precision as distance_km
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
            (CASE 
                WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 100.0
                WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 50.0
                WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 30.0
                ELSE 10.0
            END)::double precision as score,
            0.0::double precision as distance_km
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

-- Tester la fonction corrigée
SELECT 
    'Test fonction avec variables' as test_type,
    COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant',
    '4.332778557312556,9.169371770309054|3.5546023108516125,9.869750188277804|4.253351169137149,10.377867864059054|4.395766768897358,9.891722844527804',
    50,
    100
); 
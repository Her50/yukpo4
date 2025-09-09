-- FORCER L'UTILISATION DE search_services_gps_final MÊME SANS GPS
-- =============================================================

-- Modifier la fonction pour qu'elle gère mieux le cas NULL
CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query text,
    user_gps_zone text DEFAULT NULL,
    search_radius_km integer DEFAULT 50,
    max_results integer DEFAULT 20
)
RETURNS TABLE(
    service_id integer,
    titre_service text,
    category text,
    gps_coords text,
    distance_km double precision,
    relevance_score double precision,
    gps_source text
) AS $$
DECLARE
    gps_parts text[];
    lat double precision;
    lng double precision;
    radius_adjusted double precision;
BEGIN
    -- Ajuster le rayon
    radius_adjusted := calculate_intelligent_radius(search_radius_km::double precision);

    -- CAS 1: Recherche AVEC zone GPS (zone non NULL et non vide)
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' AND user_gps_zone != 'null' THEN
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
                s.id as service_id,
                s.data->>'titre_service' as titre_service,
                s.data->>'category' as category,
                extract_gps_from_json(s.data->'gps_fixe') as gps_coords,
                COALESCE(calculate_gps_distance_km(lat, lng,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                ), 0.0::double precision) as distance_km,
                (CASE
                    WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 100.0::double precision
                    WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 50.0::double precision
                    WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 30.0::double precision
                    ELSE 10.0::double precision
                END) as relevance_score,
                'service_gps_fixe' as gps_source
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
            ORDER BY relevance_score DESC, distance_km ASC
            LIMIT max_results;
        END IF;
    END IF;

    -- CAS 2: Recherche SANS zone GPS (fallback textuel)
    -- Si pas de GPS ou pas de résultats avec GPS, faire une recherche textuelle simple
    RETURN QUERY
    SELECT
        s.id as service_id,
        s.data->>'titre_service' as titre_service,
        s.data->>'category' as category,
        extract_gps_from_json(s.data->'gps_fixe') as gps_coords,
        0.0::double precision as distance_km,
        (CASE
            WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 100.0::double precision
            WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 50.0::double precision
            WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 30.0::double precision
            ELSE 10.0::double precision
        END) as relevance_score,
        'text_only' as gps_source
    FROM services s
    WHERE
        s.data->>'titre_service' ILIKE '%' || search_query || '%'
        OR s.data->>'description' ILIKE '%' || search_query || '%'
        OR s.data->>'category' ILIKE '%' || search_query || '%'
    ORDER BY relevance_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Test de la fonction modifiée
SELECT
    'Test fonction modifiee AVEC GPS' as test_type,
    COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant',
    '4.2705171468711045,9.52604977674782',
    50,
    100
);

SELECT
    'Test fonction modifiee SANS GPS' as test_type,
    COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant',
    NULL,
    50,
    100
);

-- Test avec la chaîne 'null' (cas edge)
SELECT
    'Test fonction modifiee avec "null"' as test_type,
    COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant',
    'null',
    50,
    100
); 
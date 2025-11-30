-- ============================================================
-- VERSION OPTIMISÉE CORRECTE
-- ============================================================
-- Problème : La version sans DISTINCT ON est plus lente (1082ms)
-- Solution : Garder DISTINCT ON mais optimiser différemment
-- ============================================================

DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text);
DROP FUNCTION IF EXISTS search_services_gps_final(text);
DROP FUNCTION IF EXISTS search_services_gps_final();

-- Version qui utilise les index ET garde DISTINCT ON de manière optimale
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
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    gps_parts text[];
    lat double precision;
    lng double precision;
    radius_adjusted double precision;
    query_tsquery tsquery;
BEGIN
    query_tsquery := plainto_tsquery('french', search_query);
    
    BEGIN
        radius_adjusted := COALESCE(calculate_intelligent_radius(search_radius_km::double precision), search_radius_km::double precision);
    EXCEPTION WHEN OTHERS THEN
        radius_adjusted := search_radius_km::double precision;
    END;

    -- CAS 1: Recherche AVEC zone GPS
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' AND user_gps_zone != 'null' THEN
        gps_parts := string_to_array(user_gps_zone, '|');
        
        IF array_length(gps_parts, 1) > 0 THEN
            BEGIN
                lat := split_part(gps_parts[1], ',', 1)::double precision;
                lng := split_part(gps_parts[1], ',', 2)::double precision;
            EXCEPTION WHEN OTHERS THEN
                lat := NULL;
                lng := NULL;
            END;

            IF lat IS NOT NULL AND lng IS NOT NULL THEN
                RETURN QUERY
                SELECT DISTINCT ON (s.id)
                    s.id::integer AS service_id,
                    COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')::text AS titre_service,
                    COALESCE(s.category, s.data->'category'->>'valeur', '')::text AS category,
                    COALESCE(s.gps, '')::text AS gps_coords,
                    CASE 
                        WHEN s.gps IS NOT NULL AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                            (
                                6371 * acos(
                                    GREATEST(-1.0, LEAST(1.0,
                                        cos(radians(lat)) * 
                                        cos(radians(split_part(s.gps, ',', 1)::double precision)) *
                                        cos(radians(split_part(s.gps, ',', 2)::double precision) - radians(lng)) +
                                        sin(radians(lat)) *
                                        sin(radians(split_part(s.gps, ',', 1)::double precision))
                                    ))
                                )
                            )
                        ELSE NULL
                    END AS distance_km,
                    GREATEST(
                        ts_rank(to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), query_tsquery) * 10.0,
                        ts_rank(to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), query_tsquery) * 5.0,
                        0.0
                    )::double precision AS relevance_score,
                    CASE 
                        WHEN s.gps IS NOT NULL AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN 'service_gps'::text
                        ELSE 'no_gps'::text
                    END AS gps_source
                FROM services s
                WHERE s.is_active = true
                AND (
                    to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ query_tsquery
                    OR to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')) @@ query_tsquery
                )
                AND (
                    s.gps IS NULL OR
                    (
                        s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' AND
                        (
                            6371 * acos(
                                GREATEST(-1.0, LEAST(1.0,
                                    cos(radians(lat)) * 
                                    cos(radians(split_part(s.gps, ',', 1)::double precision)) *
                                    cos(radians(split_part(s.gps, ',', 2)::double precision) - radians(lng)) +
                                    sin(radians(lat)) *
                                    sin(radians(split_part(s.gps, ',', 1)::double precision))
                                ))
                            )
                        ) <= radius_adjusted
                    )
                )
                ORDER BY s.id, relevance_score DESC
                LIMIT max_results;
                
                RETURN;
            END IF;
        END IF;
    END IF;

    -- CAS 2: Recherche SANS GPS (version optimisée)
    RETURN QUERY
    SELECT DISTINCT ON (s.id)
        s.id::integer AS service_id,
        COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')::text AS titre_service,
        COALESCE(s.category, s.data->'category'->>'valeur', '')::text AS category,
        COALESCE(s.gps, '')::text AS gps_coords,
        NULL::double precision AS distance_km,
        GREATEST(
            ts_rank(to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), query_tsquery) * 10.0,
            ts_rank(to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), query_tsquery) * 5.0,
            0.0
        )::double precision AS relevance_score,
        'text_search'::text AS gps_source
    FROM services s
    WHERE s.is_active = true
    AND (
        to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ query_tsquery
        OR to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')) @@ query_tsquery
    )
    ORDER BY s.id, relevance_score DESC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION search_services_gps_final IS 
'Version optimisée 2025-11-30: Ordre COALESCE aligné avec index, query_tsquery préparé une fois.';


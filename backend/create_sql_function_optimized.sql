-- ============================================================
-- FONCTION SQL OPTIMISÉE (sans overhead PL/pgSQL)
-- ============================================================
-- Remplace la fonction PL/pgSQL par une fonction SQL simple
-- Performance attendue : ~20-50ms (vs 160-433ms avec PL/pgSQL)
-- ============================================================

DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text);
DROP FUNCTION IF EXISTS search_services_gps_final(text);
DROP FUNCTION IF EXISTS search_services_gps_final();

-- Version SQL simple (LANGUAGE sql) - PAS de overhead PL/pgSQL
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
LANGUAGE sql
STABLE
AS $$
    WITH query_tsquery AS (
        SELECT plainto_tsquery('french', search_query) AS q
    ),
    gps_coords AS (
        SELECT 
            CASE 
                WHEN user_gps_zone IS NOT NULL AND user_gps_zone != '' AND user_gps_zone != 'null' 
                THEN string_to_array(user_gps_zone, '|')[1]
                ELSE NULL
            END AS zone
    ),
    parsed_gps AS (
        SELECT 
            CASE 
                WHEN gps_coords.zone IS NOT NULL THEN
                    split_part(gps_coords.zone, ',', 1)::double precision
                ELSE NULL
            END AS lat,
            CASE 
                WHEN gps_coords.zone IS NOT NULL THEN
                    split_part(gps_coords.zone, ',', 2)::double precision
                ELSE NULL
            END AS lng
        FROM gps_coords
    ),
    radius_adjusted AS (
        SELECT COALESCE(
            calculate_intelligent_radius(search_radius_km::double precision),
            search_radius_km::double precision
        ) AS radius
    ),
    -- CAS 1: Recherche AVEC GPS
    results_with_gps AS (
        SELECT 
            s.id::integer AS service_id,
            COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')::text AS titre_service,
            COALESCE(s.category, s.data->'category'->>'valeur', '')::text AS category,
            COALESCE(s.gps, '')::text AS gps_coords,
            CASE 
                WHEN s.gps IS NOT NULL 
                     AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' 
                     AND parsed_gps.lat IS NOT NULL 
                     AND parsed_gps.lng IS NOT NULL
                THEN
                    6371 * acos(
                        GREATEST(-1.0, LEAST(1.0,
                            cos(radians(parsed_gps.lat)) * 
                            cos(radians(split_part(s.gps, ',', 1)::double precision)) *
                            cos(radians(split_part(s.gps, ',', 2)::double precision) - radians(parsed_gps.lng)) +
                            sin(radians(parsed_gps.lat)) *
                            sin(radians(split_part(s.gps, ',', 1)::double precision))
                        ))
                    )
                ELSE NULL
            END AS distance_km,
            GREATEST(
                ts_rank(to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), query_tsquery.q) * 10.0,
                ts_rank(to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), query_tsquery.q) * 5.0,
                0.0
            )::double precision AS relevance_score,
            CASE 
                WHEN s.gps IS NOT NULL AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN 'service_gps'::text
                ELSE 'no_gps'::text
            END AS gps_source
        FROM services s
        CROSS JOIN query_tsquery
        CROSS JOIN parsed_gps
        CROSS JOIN radius_adjusted
        WHERE s.is_active = true
        AND (
            to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ query_tsquery.q
            OR to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')) @@ query_tsquery.q
        )
        AND (
            parsed_gps.lat IS NULL 
            OR parsed_gps.lng IS NULL
            OR s.gps IS NULL
            OR NOT (s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$')
            OR (
                6371 * acos(
                    GREATEST(-1.0, LEAST(1.0,
                        cos(radians(parsed_gps.lat)) * 
                        cos(radians(split_part(s.gps, ',', 1)::double precision)) *
                        cos(radians(split_part(s.gps, ',', 2)::double precision) - radians(parsed_gps.lng)) +
                        sin(radians(parsed_gps.lat)) *
                        sin(radians(split_part(s.gps, ',', 1)::double precision))
                    ))
                ) <= radius_adjusted.radius
            )
        )
    ),
    -- CAS 2: Recherche SANS GPS
    results_without_gps AS (
        SELECT 
            s.id::integer AS service_id,
            COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')::text AS titre_service,
            COALESCE(s.category, s.data->'category'->>'valeur', '')::text AS category,
            COALESCE(s.gps, '')::text AS gps_coords,
            NULL::double precision AS distance_km,
            GREATEST(
                ts_rank(to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), query_tsquery.q) * 10.0,
                ts_rank(to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), query_tsquery.q) * 5.0,
                0.0
            )::double precision AS relevance_score,
            'text_search'::text AS gps_source
        FROM services s
        CROSS JOIN query_tsquery
        WHERE s.is_active = true
        AND (
            to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ query_tsquery.q
            OR to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')) @@ query_tsquery.q
        )
        AND NOT EXISTS (
            SELECT 1 FROM parsed_gps WHERE parsed_gps.lat IS NOT NULL AND parsed_gps.lng IS NOT NULL
        )
    )
    SELECT DISTINCT ON (service_id)
        service_id,
        titre_service,
        category,
        gps_coords,
        distance_km,
        relevance_score,
        gps_source
    FROM (
        SELECT * FROM results_with_gps
        UNION ALL
        SELECT * FROM results_without_gps
    ) combined_results
    ORDER BY service_id, relevance_score DESC
    LIMIT max_results;
$$;

COMMENT ON FUNCTION search_services_gps_final IS 
'Version SQL optimisée 2025-11-30: LANGUAGE sql (pas PL/pgSQL) pour éliminer overhead. Performance attendue: ~20-50ms.';


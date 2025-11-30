-- ============================================================
-- FONCTION SQL OPTIMISÉE (sans overhead PL/pgSQL) - VERSION CORRIGÉE
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
    gps_parsed AS (
        SELECT 
            CASE 
                WHEN user_gps_zone IS NOT NULL AND user_gps_zone != '' AND user_gps_zone != 'null' 
                THEN split_part((string_to_array(user_gps_zone, '|'))[1], ',', 1)::double precision
                ELSE NULL
            END AS lat,
            CASE 
                WHEN user_gps_zone IS NOT NULL AND user_gps_zone != '' AND user_gps_zone != 'null' 
                THEN split_part((string_to_array(user_gps_zone, '|'))[1], ',', 2)::double precision
                ELSE NULL
            END AS lng
    ),
    radius_adjusted AS (
        SELECT COALESCE(
            calculate_intelligent_radius(search_radius_km::double precision),
            search_radius_km::double precision
        ) AS radius
    ),
    results AS (
        SELECT DISTINCT ON (s.id)
            s.id::integer AS service_id,
            COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')::text AS titre_service,
            COALESCE(s.category, s.data->'category'->>'valeur', '')::text AS category,
            COALESCE(s.gps, '')::text AS gps_coords,
            CASE 
                WHEN s.gps IS NOT NULL 
                     AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' 
                     AND gps_parsed.lat IS NOT NULL 
                     AND gps_parsed.lng IS NOT NULL
                THEN
                    6371 * acos(
                        GREATEST(-1.0, LEAST(1.0,
                            cos(radians(gps_parsed.lat)) * 
                            cos(radians(split_part(s.gps, ',', 1)::double precision)) *
                            cos(radians(split_part(s.gps, ',', 2)::double precision) - radians(gps_parsed.lng)) +
                            sin(radians(gps_parsed.lat)) *
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
                WHEN s.gps IS NOT NULL 
                     AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' 
                     AND gps_parsed.lat IS NOT NULL 
                     AND gps_parsed.lng IS NOT NULL
                THEN 'service_gps'::text
                WHEN gps_parsed.lat IS NULL OR gps_parsed.lng IS NULL
                THEN 'text_search'::text
                ELSE 'no_gps'::text
            END AS gps_source
        FROM services s
        CROSS JOIN query_tsquery
        CROSS JOIN gps_parsed
        CROSS JOIN radius_adjusted
        WHERE s.is_active = true
        AND (
            to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ query_tsquery.q
            OR to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')) @@ query_tsquery.q
        )
        AND (
            gps_parsed.lat IS NULL 
            OR gps_parsed.lng IS NULL
            OR s.gps IS NULL
            OR NOT (s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$')
            OR (
                6371 * acos(
                    GREATEST(-1.0, LEAST(1.0,
                        cos(radians(gps_parsed.lat)) * 
                        cos(radians(split_part(s.gps, ',', 1)::double precision)) *
                        cos(radians(split_part(s.gps, ',', 2)::double precision) - radians(gps_parsed.lng)) +
                        sin(radians(gps_parsed.lat)) *
                        sin(radians(split_part(s.gps, ',', 1)::double precision))
                    ))
                ) <= radius_adjusted.radius
            )
        )
        ORDER BY s.id, relevance_score DESC
    )
    SELECT 
        service_id,
        titre_service,
        category,
        gps_coords,
        distance_km,
        relevance_score,
        gps_source
    FROM results
    ORDER BY relevance_score DESC, service_id
    LIMIT max_results;
$$;

COMMENT ON FUNCTION search_services_gps_final IS 
'Version SQL optimisée 2025-11-30: LANGUAGE sql (pas PL/pgSQL) pour éliminer overhead. Performance attendue: ~20-50ms.';


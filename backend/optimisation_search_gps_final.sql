-- ============================================================
-- OPTIMISATION DE search_services_gps_final
-- ============================================================
-- Problèmes identifiés:
-- 1. Les index GIN ne sont PAS utilisés (0 scans)
-- 2. La fonction lit 7008 buffers (vs 2216 pour recherche directe)
-- 3. DISTINCT ON avec ORDER BY sur expression calculée est coûteux
-- 4. ts_rank recalculé plusieurs fois
-- ============================================================

DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text);
DROP FUNCTION IF EXISTS search_services_gps_final(text);
DROP FUNCTION IF EXISTS search_services_gps_final();

-- Version optimisée qui utilise les index GIN
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
    -- Préparer la requête full-text une seule fois
    query_tsquery := plainto_tsquery('french', search_query);
    
    -- Ajuster le rayon
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
                -- Version optimisée avec CTE pour éviter recalculs
                RETURN QUERY
                WITH ranked_services AS (
                    SELECT 
                        s.id,
                        COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '')::text AS titre,
                        COALESCE(s.category, s.data->'category'->>'valeur', '')::text AS cat,
                        COALESCE(s.gps, '')::text AS gps_val,
                        GREATEST(
                            ts_rank(to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')), query_tsquery) * 10.0,
                            ts_rank(to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')), query_tsquery) * 5.0,
                            0.0
                        ) AS score,
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
                        END AS dist
                    FROM services s
                    WHERE s.is_active = true
                    AND (
                        to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ query_tsquery
                        OR to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')) @@ query_tsquery
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
                )
                SELECT DISTINCT ON (id)
                    id::integer,
                    titre,
                    cat,
                    gps_val,
                    dist,
                    score,
                    CASE WHEN gps_val ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN 'service_gps'::text ELSE 'no_gps'::text END
                FROM ranked_services
                ORDER BY id, score DESC
                LIMIT max_results;
                
                RETURN;
            END IF;
        END IF;
    END IF;

    -- CAS 2: Recherche SANS GPS (version optimisée)
    RETURN QUERY
    WITH ranked_services AS (
        SELECT 
            s.id,
            COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '')::text AS titre,
            COALESCE(s.category, s.data->'category'->>'valeur', '')::text AS cat,
            COALESCE(s.gps, '')::text AS gps_val,
            GREATEST(
                ts_rank(to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')), query_tsquery) * 10.0,
                ts_rank(to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')), query_tsquery) * 5.0,
                0.0
            ) AS score
        FROM services s
        WHERE s.is_active = true
        AND (
            to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ query_tsquery
            OR to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')) @@ query_tsquery
        )
    )
    SELECT DISTINCT ON (id)
        id::integer,
        titre,
        cat,
        gps_val,
        NULL::double precision,
        score,
        'text_search'::text
    FROM ranked_services
    ORDER BY id, score DESC
    LIMIT max_results;
END;
$$;

-- Commentaire
COMMENT ON FUNCTION search_services_gps_final IS 
'Version optimisée 2025-11-30: Utilise CTE pour éviter recalculs, prépare query_tsquery une seule fois.';


-- Migration: AMELIORATION RECHERCHE - Variations et trigram
-- Date: 2025-11-30
-- Description: Ameliore search_services_gps_final pour gerer :
--              1. Variations (plombier/plomberie) via requete enrichie avec OR (|)
--              2. Recherche trigram integree (pas seulement fallback)
--              3. Similarite pour erreurs de saisie et variations

-- 1. CRÉER FONCTION HELPER pour recherche avec variations et trigram
CREATE OR REPLACE FUNCTION search_text_matches(
    search_text text,
    target_text text,
    threshold double precision DEFAULT 0.6
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    similarity_score double precision;
    fulltext_score double precision;
BEGIN
    -- 1. Recherche full-text avec requete enrichie (peut contenir "plombier | plomberie")
    BEGIN
        fulltext_score := ts_rank(
            to_tsvector('french', COALESCE(target_text, '')),
            plainto_tsquery('french', search_text)
        );
    EXCEPTION WHEN OTHERS THEN
        fulltext_score := 0.0;
    END;
    
    -- 2. Recherche trigram pour variations et fautes de frappe
    BEGIN
        similarity_score := similarity(LOWER(COALESCE(target_text, '')), LOWER(search_text));
    EXCEPTION WHEN OTHERS THEN
        similarity_score := 0.0;
    END;
    
    -- Retourner le score maximum entre full-text et trigram
    RETURN GREATEST(
        fulltext_score * 10.0,
        CASE 
            WHEN similarity_score >= threshold THEN similarity_score * 8.0
            ELSE 0.0
        END
    );
END;
$$;

COMMENT ON FUNCTION search_text_matches IS 
'Calcule un score combine full-text + trigram pour gerer variations et fautes de frappe';

-- 2. AMELIORER search_services_gps_final avec recherche trigram integree
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
    search_terms text[];
    base_term text;
BEGIN
    -- Ajuster le rayon
    BEGIN
        radius_adjusted := COALESCE(calculate_intelligent_radius(search_radius_km::double precision), search_radius_km::double precision);
    EXCEPTION WHEN OTHERS THEN
        radius_adjusted := search_radius_km::double precision;
    END;

    -- Extraire le terme de base (sans les |)
    base_term := split_part(search_query, '|', 1);
    base_term := trim(base_term);

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
                    COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '')::text AS titre_service,
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
                        ts_rank(to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', search_query)) * 10.0,
                        ts_rank(to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), plainto_tsquery('french', search_query)) * 5.0,
                        CASE 
                            WHEN similarity(LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), LOWER(base_term)) > 0.6 THEN 
                                similarity(LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), LOWER(base_term)) * 8.0
                            ELSE 0.0
                        END,
                        CASE 
                            WHEN similarity(LOWER(COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), LOWER(base_term)) > 0.5 THEN 
                                similarity(LOWER(COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), LOWER(base_term)) * 6.0
                            ELSE 0.0
                        END,
                        CASE 
                            WHEN similarity(LOWER(COALESCE(s.category, s.data->'category'->>'valeur', '')), LOWER(base_term)) > 0.7 THEN 
                                similarity(LOWER(COALESCE(s.category, s.data->'category'->>'valeur', '')), LOWER(base_term)) * 9.0
                            ELSE 0.0
                        END,
                        CASE 
                            WHEN LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) = LOWER(base_term) THEN 15.0
                            WHEN LOWER(COALESCE(s.category, s.data->'category'->>'valeur', '')) = LOWER(base_term) THEN 12.0
                            ELSE 0.0
                        END,
                        0.0
                    )::double precision AS relevance_score,
                    (CASE 
                        WHEN s.gps IS NOT NULL AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN 'service_gps'
                        ELSE 'no_gps'
                    END)::text AS gps_source
                FROM services s
                WHERE s.is_active = true
                AND (
                    to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
                    OR to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
                    OR similarity(LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), LOWER(base_term)) > 0.6
                    OR similarity(LOWER(COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), LOWER(base_term)) > 0.5
                    OR similarity(LOWER(COALESCE(s.category, s.data->'category'->>'valeur', '')), LOWER(base_term)) > 0.7
                    OR COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || base_term || '%'
                    OR COALESCE(s.category, s.data->'category'->>'valeur', '') ILIKE '%' || base_term || '%'
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

    -- CAS 2: Recherche SANS GPS
    RETURN QUERY
    SELECT DISTINCT ON (s.id)
        s.id::integer AS service_id,
        COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '')::text AS titre_service,
        COALESCE(s.category, s.data->'category'->>'valeur', '')::text AS category,
        COALESCE(s.gps, '')::text AS gps_coords,
        NULL::double precision AS distance_km,
        GREATEST(
            ts_rank(to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', search_query)) * 10.0,
            ts_rank(to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), plainto_tsquery('french', search_query)) * 5.0,
            CASE 
                WHEN similarity(LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), LOWER(base_term)) > 0.6 THEN 
                    similarity(LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), LOWER(base_term)) * 8.0
                ELSE 0.0
            END,
            CASE 
                WHEN similarity(LOWER(COALESCE(s.category, s.data->'category'->>'valeur', '')), LOWER(base_term)) > 0.7 THEN 
                    similarity(LOWER(COALESCE(s.category, s.data->'category'->>'valeur', '')), LOWER(base_term)) * 9.0
                ELSE 0.0
            END,
            CASE 
                WHEN LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) = LOWER(base_term) THEN 15.0
                WHEN LOWER(COALESCE(s.category, s.data->'category'->>'valeur', '')) = LOWER(base_term) THEN 12.0
                ELSE 0.0
            END,
            0.0
        )::double precision AS relevance_score,
        ('text_search')::text AS gps_source
    FROM services s
    WHERE s.is_active = true
    AND (
        to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
        OR to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
        OR similarity(LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), LOWER(base_term)) > 0.6
        OR similarity(LOWER(COALESCE(s.category, s.data->'category'->>'valeur', '')), LOWER(base_term)) > 0.7
        OR COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || base_term || '%'
        OR COALESCE(s.category, s.data->'category'->>'valeur', '') ILIKE '%' || base_term || '%'
    )
    ORDER BY s.id, relevance_score DESC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION search_services_gps_final IS 
'Ameliore 2025-11-30: Gerer les variations (plombier/plomberie) via requete enrichie + trigram integre pour fautes de frappe';

-- 3. VERIFICATION
DO $$
DECLARE
    func_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'search_services_gps_final'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) INTO func_exists;
    
    IF NOT func_exists THEN
        RAISE EXCEPTION 'ERREUR: search_services_gps_final n''existe pas apres la migration!';
    END IF;
    
    RAISE NOTICE 'Migration reussie: search_services_gps_final amelioree pour variations et trigram';
END;
$$;


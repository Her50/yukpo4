-- Migration: FIX RECHERCHE - Utiliser word_similarity au lieu de similarity
-- Date: 2025-11-30
-- Description: Corrige search_services_gps_final pour utiliser word_similarity
--              qui est plus adapté pour comparer des mots dans une chaîne
--              au lieu de similarity qui compare la chaîne complète

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
    query_words text[]; -- ✅ NOUVEAU: Mots de la requête enrichie
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
    
    -- ✅ NOUVEAU 2025-11-30: Extraire tous les mots de la requête enrichie (peut contenir "plombier | plomberie")
    -- Split par "|" puis par espaces pour obtenir tous les mots individuels
    SELECT array_agg(DISTINCT trim(word))
    INTO query_words
    FROM unnest(string_to_array(replace(search_query, '|', ' '), ' ')) AS word
    WHERE trim(word) != '';
    
    -- Si vide, utiliser au moins le base_term
    IF query_words IS NULL OR array_length(query_words, 1) IS NULL THEN
        query_words := ARRAY[base_term];
    END IF;

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
                        -- Full-text search avec requête enrichie
                        ts_rank(to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', search_query)) * 10.0,
                        ts_rank(to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), plainto_tsquery('french', search_query)) * 5.0,
                        -- ✅ CORRIGÉ: Utiliser word_similarity au lieu de similarity (meilleur pour mots dans chaîne)
                        CASE 
                            WHEN word_similarity(LOWER(base_term), LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', ''))) > 0.5 THEN 
                                word_similarity(LOWER(base_term), LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', ''))) * 8.0
                            ELSE 0.0
                        END,
                        CASE 
                            WHEN word_similarity(LOWER(base_term), LOWER(COALESCE(s.data->>'description', s.data->'description'->>'valeur', ''))) > 0.5 THEN 
                                word_similarity(LOWER(base_term), LOWER(COALESCE(s.data->>'description', s.data->'description'->>'valeur', ''))) * 6.0
                            ELSE 0.0
                        END,
                        CASE 
                            WHEN word_similarity(LOWER(base_term), LOWER(COALESCE(s.category, s.data->'category'->>'valeur', ''))) > 0.5 THEN 
                                word_similarity(LOWER(base_term), LOWER(COALESCE(s.category, s.data->'category'->>'valeur', ''))) * 9.0
                            ELSE 0.0
                        END,
                        -- ✅ NOUVEAU: Recherche word_similarity pour chaque mot de la requête enrichie
                        (
                            SELECT MAX(word_similarity(LOWER(word), LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')))) * 8.0
                            FROM unnest(query_words) AS word
                            WHERE word_similarity(LOWER(word), LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', ''))) > 0.5
                        ),
                        (
                            SELECT MAX(word_similarity(LOWER(word), LOWER(COALESCE(s.category, s.data->'category'->>'valeur', '')))) * 9.0
                            FROM unnest(query_words) AS word
                            WHERE word_similarity(LOWER(word), LOWER(COALESCE(s.category, s.data->'category'->>'valeur', ''))) > 0.5
                        ),
                        -- Recherche exacte
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
                    -- Full-text avec requête enrichie
                    to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
                    OR to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
                    -- ✅ CORRIGÉ: Utiliser word_similarity avec seuil 0.5 (plus permissif)
                    OR word_similarity(LOWER(base_term), LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', ''))) > 0.5
                    OR word_similarity(LOWER(base_term), LOWER(COALESCE(s.category, s.data->'category'->>'valeur', ''))) > 0.5
                    -- ✅ NOUVEAU: Recherche word_similarity pour chaque mot de la requête enrichie
                    OR EXISTS (
                        SELECT 1 FROM unnest(query_words) AS word
                        WHERE word_similarity(LOWER(word), LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', ''))) > 0.5
                    )
                    OR EXISTS (
                        SELECT 1 FROM unnest(query_words) AS word
                        WHERE word_similarity(LOWER(word), LOWER(COALESCE(s.category, s.data->'category'->>'valeur', ''))) > 0.5
                    )
                    -- ✅ NOUVEAU: Recherche ILIKE pour chaque mot (fallback si word_similarity échoue)
                    OR EXISTS (
                        SELECT 1 FROM unnest(query_words) AS word
                        WHERE COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || word || '%'
                    )
                    OR EXISTS (
                        SELECT 1 FROM unnest(query_words) AS word
                        WHERE COALESCE(s.category, s.data->'category'->>'valeur', '') ILIKE '%' || word || '%'
                    )
                    -- Recherche ILIKE sur base_term (pour compatibilité)
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
            -- Full-text avec requête enrichie
            ts_rank(to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', search_query)) * 10.0,
            ts_rank(to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), plainto_tsquery('french', search_query)) * 5.0,
            -- ✅ CORRIGÉ: Utiliser word_similarity
            CASE 
                WHEN word_similarity(LOWER(base_term), LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', ''))) > 0.5 THEN 
                    word_similarity(LOWER(base_term), LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', ''))) * 8.0
                ELSE 0.0
            END,
            CASE 
                WHEN word_similarity(LOWER(base_term), LOWER(COALESCE(s.category, s.data->'category'->>'valeur', ''))) > 0.5 THEN 
                    word_similarity(LOWER(base_term), LOWER(COALESCE(s.category, s.data->'category'->>'valeur', ''))) * 9.0
                ELSE 0.0
            END,
            -- ✅ NOUVEAU: Recherche word_similarity pour chaque mot de la requête enrichie
            (
                SELECT MAX(word_similarity(LOWER(word), LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')))) * 8.0
                FROM unnest(query_words) AS word
                WHERE word_similarity(LOWER(word), LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', ''))) > 0.5
            ),
            (
                SELECT MAX(word_similarity(LOWER(word), LOWER(COALESCE(s.category, s.data->'category'->>'valeur', '')))) * 9.0
                FROM unnest(query_words) AS word
                WHERE word_similarity(LOWER(word), LOWER(COALESCE(s.category, s.data->'category'->>'valeur', ''))) > 0.5
            ),
            -- Recherche exacte
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
        -- Full-text avec requête enrichie
        to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
        OR to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
        -- ✅ CORRIGÉ: Utiliser word_similarity avec seuil 0.5
        OR word_similarity(LOWER(base_term), LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', ''))) > 0.5
        OR word_similarity(LOWER(base_term), LOWER(COALESCE(s.category, s.data->'category'->>'valeur', ''))) > 0.5
        -- ✅ NOUVEAU: Recherche word_similarity pour chaque mot de la requête enrichie
        OR EXISTS (
            SELECT 1 FROM unnest(query_words) AS word
            WHERE word_similarity(LOWER(word), LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', ''))) > 0.5
        )
        OR EXISTS (
            SELECT 1 FROM unnest(query_words) AS word
            WHERE word_similarity(LOWER(word), LOWER(COALESCE(s.category, s.data->'category'->>'valeur', ''))) > 0.5
        )
        -- ✅ NOUVEAU: Recherche ILIKE pour chaque mot (fallback)
        OR EXISTS (
            SELECT 1 FROM unnest(query_words) AS word
            WHERE COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || word || '%'
        )
        OR EXISTS (
            SELECT 1 FROM unnest(query_words) AS word
            WHERE COALESCE(s.category, s.data->'category'->>'valeur', '') ILIKE '%' || word || '%'
        )
        -- Recherche ILIKE sur base_term
        OR COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || base_term || '%'
        OR COALESCE(s.category, s.data->'category'->>'valeur', '') ILIKE '%' || base_term || '%'
    )
    ORDER BY s.id, relevance_score DESC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION search_services_gps_final IS 
'CORRIGE 2025-11-30: Utilise word_similarity au lieu de similarity pour mieux detecter les mots dans une chaine. Recherche ILIKE pour chaque mot de la requete enrichie.';

-- VERIFICATION
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
    
    RAISE NOTICE 'Migration reussie: search_services_gps_final corrigee pour utiliser word_similarity';
END;
$$;


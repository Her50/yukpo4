-- ============================================================
-- CORRECTION PROBLÈME RECHERCHE - FONCTION GPS SEULEMENT
-- ============================================================
-- Date: 2025-11-30
-- Problème identifié:
-- Fonction search_services_gps_final avec erreur de structure
-- "structure of query does not match function result type"
-- 
-- ⚠️ IMPORTANT: Ne PAS créer d'index (déjà 23+ index pour la recherche)
-- ⚠️ Ce script corrige UNIQUEMENT la fonction GPS, rien d'autre
-- ============================================================

-- 1. SUPPRIMER TOUTES LES VERSIONS EXISTANTES DE LA FONCTION
-- ============================================================
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text);
DROP FUNCTION IF EXISTS search_services_gps_final(text);
DROP FUNCTION IF EXISTS search_services_gps_final();

-- 2. CRÉER LA FONCTION AVEC LA SIGNATURE EXACTE ATTENDUE PAR LE CODE RUST
-- ============================================================
-- Le code Rust attend exactement ces colonnes dans cet ordre :
-- service_id, titre_service, category, gps_coords, distance_km, relevance_score, gps_source

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
BEGIN
    -- Ajuster le rayon (utiliser fonction helper si elle existe, sinon valeur directe)
    BEGIN
        radius_adjusted := COALESCE(calculate_intelligent_radius(search_radius_km::double precision), search_radius_km::double precision);
    EXCEPTION WHEN OTHERS THEN
        radius_adjusted := search_radius_km::double precision;
    END;

    -- CAS 1: Recherche AVEC zone GPS
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' AND user_gps_zone != 'null' THEN
        -- Extraire les coordonnées GPS
        gps_parts := string_to_array(user_gps_zone, '|');
        
        IF array_length(gps_parts, 1) > 0 THEN
            BEGIN
                lat := split_part(gps_parts[1], ',', 1)::double precision;
                lng := split_part(gps_parts[1], ',', 2)::double precision;
            EXCEPTION WHEN OTHERS THEN
                -- Si parsing échoue, faire recherche sans GPS
                lat := NULL;
                lng := NULL;
            END;

            IF lat IS NOT NULL AND lng IS NOT NULL THEN
                -- Recherche avec GPS - version simplifiée utilisant les index existants
                RETURN QUERY
                SELECT DISTINCT ON (s.id)
                    s.id::integer AS service_id,
                    COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '') AS titre_service,
                    COALESCE(s.category, s.data->'category'->>'valeur', '') AS category,
                    COALESCE(s.gps, '') AS gps_coords,
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
                        ts_rank(to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', search_query)) * 10.0,
                        ts_rank(to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')), plainto_tsquery('french', search_query)) * 5.0,
                        0.0
                    )::double precision AS relevance_score,
                    CASE 
                        WHEN s.gps IS NOT NULL AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN 'service_gps'::text
                        ELSE 'no_gps'::text
                    END AS gps_source
                FROM services s
                WHERE s.is_active = true
                AND (
                    to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
                    OR to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
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

    -- CAS 2: Recherche SANS GPS (recherche textuelle pure)
    RETURN QUERY
    SELECT DISTINCT ON (s.id)
        s.id::integer AS service_id,
        COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '') AS titre_service,
        COALESCE(s.category, s.data->'category'->>'valeur', '') AS category,
        COALESCE(s.gps, '') AS gps_coords,
        NULL::double precision AS distance_km,
        GREATEST(
            ts_rank(to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', search_query)) * 10.0,
            ts_rank(to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')), plainto_tsquery('french', search_query)) * 5.0,
            0.0
        )::double precision AS relevance_score,
        'text_search'::text AS gps_source
    FROM services s
    WHERE s.is_active = true
    AND (
        to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
        OR to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
    )
    ORDER BY s.id, relevance_score DESC
    LIMIT max_results;
END;
$$;

-- 3. FONCTION HELPER (crée seulement si elle n'existe pas déjà)
-- ============================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'calculate_intelligent_radius'
        AND n.nspname = 'public'
    ) THEN
        CREATE FUNCTION calculate_intelligent_radius(requested_radius double precision)
        RETURNS double precision
        LANGUAGE plpgsql
        IMMUTABLE
        AS $$
        BEGIN
            RETURN COALESCE(requested_radius, 50.0);
        END;
        $$;
    END IF;
END $$;

-- 4. COMMENTAIRES
-- ============================================================
COMMENT ON FUNCTION search_services_gps_final IS 
'Recherche optimisée de services avec ou sans GPS. Version corrigée pour éviter les erreurs de structure. Utilise les index existants.';

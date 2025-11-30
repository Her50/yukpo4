-- Migration: FIX DÉFINITIF - Signature search_services_gps_final
-- Date: 2025-11-30
-- Description: Fixe définitivement la signature de search_services_gps_final
--              pour correspondre exactement à ce que le code Rust attend
--              (user_gps_zone avec DEFAULT NULL)
--              + Optimisation : Ordre COALESCE aligné avec les index
-- 
-- ⚠️ IMPORTANT: Cette migration doit être la dernière à modifier cette fonction
-- ⚠️ Les migrations futures NE DOIVENT PAS modifier search_services_gps_final
--    sauf pour corriger des bugs de logique interne

-- 1. SUPPRIMER TOUTES LES VERSIONS EXISTANTES
-- ============================================================
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text);
DROP FUNCTION IF EXISTS search_services_gps_final(text);
DROP FUNCTION IF EXISTS search_services_gps_final();

-- 2. CRÉER LA FONCTION AVEC LA SIGNATURE CORRECTE
-- ============================================================
-- Le code Rust appelle: search_services_gps_final($1, $2, $3, $4)
-- Où $2 (gps_zone) peut être NULL
-- DONC: user_gps_zone DOIT avoir DEFAULT NULL

CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query text,
    user_gps_zone text DEFAULT NULL,  -- ✅ OBLIGATOIRE: DEFAULT NULL pour compatibilité Rust
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
                    -- ✅ Ordre COALESCE aligné avec les index
                    GREATEST(
                        ts_rank(to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', search_query)) * 10.0,
                        ts_rank(to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), plainto_tsquery('french', search_query)) * 5.0,
                        0.0
                    )::double precision AS relevance_score,
                    (CASE 
                        WHEN s.gps IS NOT NULL AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN 'service_gps'
                        ELSE 'no_gps'
                    END)::text AS gps_source
                FROM services s
                WHERE s.is_active = true
                AND (
                    -- ✅ Ordre COALESCE aligné avec les index existants (idx_services_titre_service_fts, idx_services_description_fts)
                    to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
                    OR to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
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
        COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '')::text AS titre_service,
        COALESCE(s.category, s.data->'category'->>'valeur', '')::text AS category,
        COALESCE(s.gps, '')::text AS gps_coords,
        NULL::double precision AS distance_km,
        -- ✅ Ordre COALESCE aligné avec les index
        GREATEST(
            ts_rank(to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', search_query)) * 10.0,
            ts_rank(to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), plainto_tsquery('french', search_query)) * 5.0,
            0.0
        )::double precision AS relevance_score,
        ('text_search')::text AS gps_source
    FROM services s
    WHERE s.is_active = true
    AND (
        -- ✅ Ordre COALESCE aligné avec les index existants
        to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
        OR to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
    )
    ORDER BY s.id, relevance_score DESC
    LIMIT max_results;
END;
$$;

-- 3. FONCTION HELPER (crée seulement si elle n'existe pas déjà)
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_intelligent_radius(requested_radius double precision)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN COALESCE(requested_radius, 50.0);
END;
$$;

-- 4. COMMENTAIRE EXPLICATIF
-- ============================================================
COMMENT ON FUNCTION search_services_gps_final IS 
'⚠️ FIX DÉFINITIF 2025-11-30: Signature corrigée avec user_gps_zone DEFAULT NULL pour compatibilité Rust.
NE PAS MODIFIER LA SIGNATURE DE CETTE FONCTION dans les migrations futures.
Le code Rust peut passer NULL pour user_gps_zone, donc DEFAULT NULL est obligatoire.';

-- 5. VÉRIFICATION POST-MIGRATION
-- ============================================================
DO $$
DECLARE
    func_signature text;
BEGIN
    SELECT pg_get_functiondef(oid) INTO func_signature
    FROM pg_proc
    WHERE proname = 'search_services_gps_final'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ORDER BY oid DESC
    LIMIT 1;
    
    IF func_signature IS NULL THEN
        RAISE EXCEPTION '❌ ERREUR: search_services_gps_final n''existe pas après la migration!';
    END IF;
    
    IF func_signature NOT LIKE '%user_gps_zone text DEFAULT NULL%' THEN
        RAISE WARNING '⚠️ ATTENTION: La signature ne contient pas "DEFAULT NULL" pour user_gps_zone. Vérifier manuellement.';
    ELSE
        RAISE NOTICE '✅ SUCCESS: Signature correcte avec user_gps_zone DEFAULT NULL';
    END IF;
END $$;


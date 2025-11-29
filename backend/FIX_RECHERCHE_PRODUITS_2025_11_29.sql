-- ============================================================
-- CORRECTION DES PROBLÈMES DE RECHERCHE - 29 Novembre 2025
-- ============================================================
-- Problèmes identifiés :
-- 1. Erreur "structure of query does not match function result type"
-- 2. Requêtes SQL très lentes (4+ secondes)
-- 3. 0 résultats pour certaines recherches
-- ============================================================

-- ÉTAPE 1: Vérifier la signature actuelle de la fonction
-- ============================================================
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'search_services_gps_final'
ORDER BY p.oid DESC
LIMIT 1;

-- ÉTAPE 2: Supprimer toutes les versions existantes
-- ============================================================
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text);
DROP FUNCTION IF EXISTS search_services_gps_final(text);
DROP FUNCTION IF EXISTS search_services_gps_final();

-- ÉTAPE 3: Créer une fonction simplifiée et robuste
-- ============================================================
-- Cette version :
-- - Gère les formats GPS simples (lat,lng) et polygonaux (lat1,lng1|lat2,lng2|...)
-- - Ne dépend pas de fonctions externes qui pourraient ne pas exister
-- - Retourne exactement les 7 colonnes attendues par Rust
-- - Utilise des calculs de distance simples (formule haversine) si PostGIS n'est pas disponible

CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query TEXT,
    user_gps_zone TEXT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE (
    service_id INTEGER,
    titre_service TEXT,
    category TEXT,
    gps_coords TEXT,
    distance_km DOUBLE PRECISION,
    relevance_score DOUBLE PRECISION,
    gps_source TEXT
) AS $$
DECLARE
    gps_parts TEXT[];
    lat DOUBLE PRECISION;
    lng DOUBLE PRECISION;
    radius_adjusted DOUBLE PRECISION;
    user_lat DOUBLE PRECISION;
    user_lng DOUBLE PRECISION;
BEGIN
    -- Ajuster le rayon (fallback si calculate_intelligent_radius n'existe pas)
    BEGIN
        SELECT calculate_intelligent_radius(search_radius_km::DOUBLE PRECISION) INTO radius_adjusted;
    EXCEPTION
        WHEN OTHERS THEN
            radius_adjusted := search_radius_km::DOUBLE PRECISION;
    END;
    
    -- Extraire les coordonnées GPS utilisateur
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' AND user_gps_zone != 'null' THEN
        -- Gérer les formats : "lat,lng" ou "lat1,lng1|lat2,lng2|..."
        gps_parts := string_to_array(user_gps_zone, '|');
        
        IF array_length(gps_parts, 1) > 0 THEN
            -- Extraire lat,lng du premier point
            BEGIN
                user_lat := split_part(gps_parts[1], ',', 1)::DOUBLE PRECISION;
                user_lng := split_part(gps_parts[1], ',', 2)::DOUBLE PRECISION;
            EXCEPTION
                WHEN OTHERS THEN
                    -- Si le parsing échoue, utiliser NULL pour désactiver le filtrage GPS
                    user_lat := NULL;
                    user_lng := NULL;
            END;
        END IF;
    END IF;
    
    -- CAS 1: Recherche AVEC GPS (si coordonnées valides)
    IF user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
        RETURN QUERY
        WITH service_scores AS (
            SELECT 
                s.id,
                COALESCE(
                    s.data->>'titre_service',
                    s.data->'titre_service'->>'valeur',
                    s.data->>'titre',
                    'Sans titre'
                ) as titre,
                COALESCE(
                    s.data->>'category',
                    s.data->'category'->>'valeur',
                    s.category,
                    'Non catégorisé'
                ) as cat,
                COALESCE(s.gps, s.data->>'gps_fixe', s.data->'gps_fixe'->>'valeur', '') as gps_val,
                -- Calculer la distance (formule haversine simplifiée)
                CASE 
                    WHEN s.gps IS NOT NULL AND s.gps != '' AND position(',' in s.gps) > 0 THEN
                        -- Utiliser ST_Distance si PostGIS est disponible, sinon formule simple
                        (
                            SELECT CASE 
                                WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
                                    ST_Distance(
                                        ST_MakePoint(user_lng, user_lat)::geography,
                                        ST_MakePoint(
                                            split_part(s.gps, ',', 2)::DOUBLE PRECISION,
                                            split_part(s.gps, ',', 1)::DOUBLE PRECISION
                                        )::geography
                                    ) / 1000.0
                                ELSE
                                    -- Formule haversine simplifiée (approximation)
                                    6371.0 * acos(
                                        LEAST(1.0, 
                                            sin(radians(user_lat)) * sin(radians(split_part(s.gps, ',', 1)::DOUBLE PRECISION)) +
                                            cos(radians(user_lat)) * cos(radians(split_part(s.gps, ',', 1)::DOUBLE PRECISION)) *
                                            cos(radians(split_part(s.gps, ',', 2)::DOUBLE PRECISION - user_lng))
                                        )
                                    )
                            END
                        )
                    WHEN s.data->>'gps_fixe' IS NOT NULL AND position(',' in (s.data->>'gps_fixe')) > 0 THEN
                        (
                            SELECT CASE 
                                WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
                                    ST_Distance(
                                        ST_MakePoint(user_lng, user_lat)::geography,
                                        ST_MakePoint(
                                            split_part(s.data->>'gps_fixe', ',', 2)::DOUBLE PRECISION,
                                            split_part(s.data->>'gps_fixe', ',', 1)::DOUBLE PRECISION
                                        )::geography
                                    ) / 1000.0
                                ELSE
                                    6371.0 * acos(
                                        LEAST(1.0,
                                            sin(radians(user_lat)) * sin(radians(split_part(s.data->>'gps_fixe', ',', 1)::DOUBLE PRECISION)) +
                                            cos(radians(user_lat)) * cos(radians(split_part(s.data->>'gps_fixe', ',', 1)::DOUBLE PRECISION)) *
                                            cos(radians(split_part(s.data->>'gps_fixe', ',', 2)::DOUBLE PRECISION - user_lng))
                                        )
                                    )
                            END
                        )
                    ELSE 999999.0
                END as dist_km,
                -- Score de pertinence
                GREATEST(
                    CASE 
                        WHEN COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 100.0
                        WHEN s.data->>'titre' ILIKE '%' || search_query || '%' THEN 100.0
                        WHEN COALESCE(s.data->>'description', s.data->'description'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 50.0
                        ELSE 10.0
                    END,
                    CASE 
                        WHEN COALESCE(s.data->>'category', s.data->'category'->>'valeur', s.category, '') ILIKE '%' || search_query || '%' THEN 30.0
                        ELSE 0.0
                    END
                ) as score,
                CASE 
                    WHEN s.gps IS NOT NULL AND s.gps != '' THEN 'gps_column'
                    WHEN s.data->>'gps_fixe' IS NOT NULL THEN 'gps_fixe'
                    ELSE 'no_gps'
                END as source
            FROM services s
            WHERE s.is_active = true
                AND (
                    COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || search_query || '%'
                    OR s.data->>'titre' ILIKE '%' || search_query || '%'
                    OR COALESCE(s.data->>'description', s.data->'description'->>'valeur', '') ILIKE '%' || search_query || '%'
                    OR COALESCE(s.data->>'category', s.data->'category'->>'valeur', s.category, '') ILIKE '%' || search_query || '%'
                )
        )
        SELECT 
            id::INTEGER as service_id,
            titre::TEXT as titre_service,
            cat::TEXT as category,
            gps_val::TEXT as gps_coords,
            dist_km::DOUBLE PRECISION as distance_km,
            score::DOUBLE PRECISION as relevance_score,
            source::TEXT as gps_source
        FROM service_scores
        WHERE dist_km <= radius_adjusted
        ORDER BY score DESC, dist_km ASC
        LIMIT max_results;
        
        RETURN;
    END IF;
    
    -- CAS 2: Recherche SANS GPS (recherche textuelle simple)
    RETURN QUERY
    SELECT 
        s.id::INTEGER as service_id,
        COALESCE(
            s.data->>'titre_service',
            s.data->'titre_service'->>'valeur',
            s.data->>'titre',
            'Sans titre'
        )::TEXT as titre_service,
        COALESCE(
            s.data->>'category',
            s.data->'category'->>'valeur',
            s.category,
            'Non catégorisé'
        )::TEXT as category,
        COALESCE(s.gps, s.data->>'gps_fixe', s.data->'gps_fixe'->>'valeur', '')::TEXT as gps_coords,
        0.0::DOUBLE PRECISION as distance_km,
        GREATEST(
            CASE 
                WHEN COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 100.0
                WHEN s.data->>'titre' ILIKE '%' || search_query || '%' THEN 100.0
                WHEN COALESCE(s.data->>'description', s.data->'description'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 50.0
                ELSE 10.0
            END,
            CASE 
                WHEN COALESCE(s.data->>'category', s.data->'category'->>'valeur', s.category, '') ILIKE '%' || search_query || '%' THEN 30.0
                ELSE 0.0
            END
        )::DOUBLE PRECISION as relevance_score,
        CASE 
            WHEN s.gps IS NOT NULL AND s.gps != '' THEN 'gps_column'::TEXT
            WHEN s.data->>'gps_fixe' IS NOT NULL THEN 'gps_fixe'::TEXT
            ELSE 'no_gps'::TEXT
        END as gps_source
    FROM services s
    WHERE s.is_active = true
        AND (
            COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || search_query || '%'
            OR s.data->>'titre' ILIKE '%' || search_query || '%'
            OR COALESCE(s.data->>'description', s.data->'description'->>'valeur', '') ILIKE '%' || search_query || '%'
            OR COALESCE(s.data->>'category', s.data->'category'->>'valeur', s.category, '') ILIKE '%' || search_query || '%'
        )
    ORDER BY relevance_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- ÉTAPE 4: Commentaire pour documentation
-- ============================================================
COMMENT ON FUNCTION search_services_gps_final(TEXT, TEXT, INTEGER, INTEGER) IS 
'Recherche de services avec filtrage GPS optionnel. Version simplifiée et robuste du 2025-11-29. 
Retourne exactement: service_id, titre_service, category, gps_coords, distance_km, relevance_score, gps_source';

-- ÉTAPE 5: Test de la fonction
-- ============================================================
-- Test avec GPS
-- SELECT * FROM search_services_gps_final('glace', '4.0301248,9.8185963', 50, 10);

-- Test sans GPS
-- SELECT * FROM search_services_gps_final('glace', NULL, 50, 10);

-- ÉTAPE 6: Vérifier que la fonction retourne les bonnes colonnes
-- ============================================================
SELECT 
    column_name,
    data_type,
    ordinal_position
FROM information_schema.columns
WHERE table_name = 'search_services_gps_final'
ORDER BY ordinal_position;


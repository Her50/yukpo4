-- Migration: Corriger la fonction search_services_gps_final pour correspondre au code Rust
-- Date: 2025-11-27
-- Description: Aligner la signature et les colonnes retournées avec ce que le code Rust attend

-- Supprimer toutes les versions existantes
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text);
DROP FUNCTION IF EXISTS search_services_gps_final(text);
DROP FUNCTION IF EXISTS search_services_gps_final();

-- Créer la fonction avec la signature exacte attendue par le code Rust
CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query TEXT,
    user_gps_zone TEXT,
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
BEGIN
    -- Ajuster le rayon si la fonction existe
    BEGIN
        radius_adjusted := calculate_intelligent_radius(search_radius_km::DOUBLE PRECISION);
    EXCEPTION
        WHEN OTHERS THEN
            radius_adjusted := search_radius_km::DOUBLE PRECISION;
    END;
    
    -- Extraire les coordonnées GPS si fournies
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' AND user_gps_zone != 'null' THEN
        -- Diviser par le séparateur "|" pour gérer les zones polygonales
        gps_parts := string_to_array(user_gps_zone, '|');
        
        -- Pour l'instant, utiliser le premier point comme centre de recherche
        IF array_length(gps_parts, 1) > 0 THEN
            -- Extraire lat,lng du premier point
            lat := split_part(gps_parts[1], ',', 1)::DOUBLE PRECISION;
            lng := split_part(gps_parts[1], ',', 2)::DOUBLE PRECISION;
            
            -- Recherche avec filtrage GPS
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
                COALESCE(
                    s.gps,
                    s.data->>'gps_fixe',
                    s.data->'gps_fixe'->>'valeur',
                    ''
                )::TEXT as gps_coords,
                CASE 
                    WHEN s.gps IS NOT NULL AND s.gps != '' THEN
                        -- Calculer la distance si GPS disponible
                        CASE 
                            WHEN position(',' in s.gps) > 0 THEN
                                calculate_gps_distance_km(
                                    lat, lng,
                                    split_part(s.gps, ',', 1)::DOUBLE PRECISION,
                                    split_part(s.gps, ',', 2)::DOUBLE PRECISION
                                )
                            ELSE 0.0
                        END
                    WHEN s.data->>'gps_fixe' IS NOT NULL AND position(',' in (s.data->>'gps_fixe')) > 0 THEN
                        calculate_gps_distance_km(
                            lat, lng,
                            split_part(s.data->>'gps_fixe', ',', 1)::DOUBLE PRECISION,
                            split_part(s.data->>'gps_fixe', ',', 2)::DOUBLE PRECISION
                        )
                    ELSE 0.0
                END::DOUBLE PRECISION as distance_km,
                (GREATEST(
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
                ))::DOUBLE PRECISION as relevance_score,
                CASE 
                    WHEN s.gps IS NOT NULL AND s.gps != '' THEN 'gps_column'::TEXT
                    WHEN s.data->>'gps_fixe' IS NOT NULL THEN 'gps_fixe'::TEXT
                    ELSE 'no_gps'::TEXT
                END as gps_source
            FROM services s
            WHERE 
                s.is_active = true
                AND (
                    COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || search_query || '%'
                    OR s.data->>'titre' ILIKE '%' || search_query || '%'
                    OR COALESCE(s.data->>'description', s.data->'description'->>'valeur', '') ILIKE '%' || search_query || '%'
                    OR COALESCE(s.data->>'category', s.data->'category'->>'valeur', s.category, '') ILIKE '%' || search_query || '%'
                )
                AND (
                    (s.gps IS NOT NULL AND s.gps != '' AND position(',' in s.gps) > 0)
                    OR (s.data->>'gps_fixe' IS NOT NULL AND position(',' in (s.data->>'gps_fixe')) > 0)
                )
                AND (
                    -- Filtrer par distance si GPS disponible
                    CASE 
                        WHEN s.gps IS NOT NULL AND position(',' in s.gps) > 0 THEN
                            calculate_gps_distance_km(
                                lat, lng,
                                split_part(s.gps, ',', 1)::DOUBLE PRECISION,
                                split_part(s.gps, ',', 2)::DOUBLE PRECISION
                            ) <= radius_adjusted
                        WHEN s.data->>'gps_fixe' IS NOT NULL AND position(',' in (s.data->>'gps_fixe')) > 0 THEN
                            calculate_gps_distance_km(
                                lat, lng,
                                split_part(s.data->>'gps_fixe', ',', 1)::DOUBLE PRECISION,
                                split_part(s.data->>'gps_fixe', ',', 2)::DOUBLE PRECISION
                            ) <= radius_adjusted
                        ELSE false
                    END
                )
            ORDER BY relevance_score DESC, distance_km ASC
            LIMIT max_results;
            
            RETURN;
        END IF;
    END IF;
    
    -- Si pas de GPS, faire une recherche textuelle simple
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
        COALESCE(
            s.gps,
            s.data->>'gps_fixe',
            s.data->'gps_fixe'->>'valeur',
            ''
        )::TEXT as gps_coords,
        0.0::DOUBLE PRECISION as distance_km,
        (GREATEST(
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
        ))::DOUBLE PRECISION as relevance_score,
        CASE 
            WHEN s.gps IS NOT NULL AND s.gps != '' THEN 'gps_column'::TEXT
            WHEN s.data->>'gps_fixe' IS NOT NULL THEN 'gps_fixe'::TEXT
            ELSE 'no_gps'::TEXT
        END as gps_source
    FROM services s
    WHERE 
        s.is_active = true
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

-- Commentaire sur la fonction
COMMENT ON FUNCTION search_services_gps_final(TEXT, TEXT, INTEGER, INTEGER) IS 
'Recherche de services avec filtrage GPS. Retourne service_id, titre_service, category, gps_coords, distance_km, relevance_score, gps_source';

-- Test de la fonction
-- SELECT * FROM search_services_gps_final('restaurant', '4.05,9.71', 50, 10);


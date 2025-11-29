-- Migration: Améliorer search_services_gps_final() pour rechercher dans les produits
-- Date: 2025-11-29
-- Description: Modifie search_services_gps_final() pour inclure la recherche dans les produits
--              (comme search_products_optimized), tout en gardant le filtrage GPS

DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text);
DROP FUNCTION IF EXISTS search_services_gps_final(text);
DROP FUNCTION IF EXISTS search_services_gps_final();

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
    BEGIN
        radius_adjusted := calculate_intelligent_radius(search_radius_km::DOUBLE PRECISION);
    EXCEPTION
        WHEN OTHERS THEN
            radius_adjusted := search_radius_km::DOUBLE PRECISION;
    END;
    
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' AND user_gps_zone != 'null' THEN
        IF position('|' in user_gps_zone) > 0 THEN
            gps_parts := string_to_array(user_gps_zone, '|');
            lat := split_part(gps_parts[1], ',', 1)::DOUBLE PRECISION;
            lng := split_part(gps_parts[1], ',', 2)::DOUBLE PRECISION;
        ELSE
            lat := split_part(user_gps_zone, ',', 1)::DOUBLE PRECISION;
            lng := split_part(user_gps_zone, ',', 2)::DOUBLE PRECISION;
        END IF;
        
        RETURN QUERY
        WITH all_products_extracted AS (
            -- ✅ CORRIGÉ: Extraire TOUS les produits de TOUS les services actifs AVANT filtrage
            SELECT 
                s.id as service_id,
                s.data as service_data,
                s.created_at,
                s.user_id,
                s.gps,
                s.category,
                CASE 
                    WHEN jsonb_typeof(s.data->'produits') = 'array' 
                    THEN s.data->'produits'
                    WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                    THEN s.data->'produits'->'valeur'
                    ELSE '[]'::jsonb
                END as products_array
            FROM services s
            WHERE s.is_active = true
            AND (
                -- Filtre GPS : doit avoir des coordonnées GPS valides
                (s.gps IS NOT NULL AND s.gps != '' AND position(',' in s.gps) > 0)
                OR (s.data->>'gps_fixe' IS NOT NULL AND position(',' in (s.data->>'gps_fixe')) > 0)
            )
        ),
        products_matched AS (
            -- ✅ Filtrer sur les PRODUITS qui matchent la recherche (GÉNÉRIQUE)
            SELECT DISTINCT
                ape.service_id,
                ape.service_data,
                ape.created_at,
                ape.user_id,
                ape.gps,
                ape.category,
                GREATEST(
                    -- Score basé sur correspondance dans produits (GÉNÉRIQUE - tous champs)
                    COALESCE((
                        SELECT MAX(
                            CASE 
                                WHEN LOWER(extract_all_product_text(product)) = LOWER(search_query) THEN 25.0
                                WHEN LOWER(extract_all_product_text(product)) LIKE LOWER(search_query) || '%' THEN 18.0
                                WHEN LOWER(COALESCE(product->>'nom', '')) = LOWER(search_query) THEN 20.0
                                WHEN product->>'nom' ILIKE '%' || search_query || '%' THEN 12.0
                                WHEN product->>'categorie' ILIKE '%' || search_query || '%' THEN 10.0
                                WHEN product->>'description' ILIKE '%' || search_query || '%' THEN 8.0
                                WHEN extract_all_product_text(product) ILIKE '%' || search_query || '%' THEN 6.0
                                ELSE 0.0
                            END
                        )
                        FROM jsonb_array_elements(ape.products_array) AS product
                        WHERE (
                            extract_all_product_text(product) ILIKE '%' || search_query || '%'
                            OR product->>'nom' ILIKE '%' || search_query || '%'
                            OR product->>'categorie' ILIKE '%' || search_query || '%'
                            OR product->>'description' ILIKE '%' || search_query || '%'
                        )
                    ), 0.0),
                    -- Score basé sur correspondance dans champs service (pour services sans produits)
                    CASE 
                        WHEN COALESCE(ape.service_data->>'titre_service', ape.service_data->'titre_service'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 10.0
                        WHEN COALESCE(ape.service_data->>'description', ape.service_data->'description'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 5.0
                        WHEN COALESCE(ape.service_data->>'category', ape.service_data->'category'->>'valeur', ape.category, '') ILIKE '%' || search_query || '%' THEN 8.0
                        ELSE 0.0
                    END
                )::DOUBLE PRECISION as relevance_score
            FROM all_products_extracted ape
            WHERE (
                -- ✅ Recherche dans les PRODUITS (GÉNÉRIQUE - tous champs)
                EXISTS (
                    SELECT 1 
                    FROM jsonb_array_elements(ape.products_array) AS product
                    WHERE (
                        extract_all_product_text(product) ILIKE '%' || search_query || '%'
                        OR product->>'nom' ILIKE '%' || search_query || '%'
                        OR product->>'categorie' ILIKE '%' || search_query || '%'
                        OR product->>'description' ILIKE '%' || search_query || '%'
                    )
                )
                -- ✅ OU recherche dans les champs service (pour services sans produits)
                OR COALESCE(ape.service_data->>'titre_service', ape.service_data->'titre_service'->>'valeur', '') ILIKE '%' || search_query || '%'
                OR COALESCE(ape.service_data->>'description', ape.service_data->'description'->>'valeur', '') ILIKE '%' || search_query || '%'
                OR COALESCE(ape.service_data->>'category', ape.service_data->'category'->>'valeur', ape.category, '') ILIKE '%' || search_query || '%'
            )
        )
        SELECT 
            pm.service_id::INTEGER,
            COALESCE(
                pm.service_data->>'titre_service',
                pm.service_data->'titre_service'->>'valeur',
                pm.service_data->>'titre',
                'Sans titre'
            )::TEXT as titre_service,
            COALESCE(
                pm.service_data->>'category',
                pm.service_data->'category'->>'valeur',
                pm.category,
                'Non catégorisé'
            )::TEXT as category,
            COALESCE(
                pm.gps,
                pm.service_data->>'gps_fixe',
                pm.service_data->'gps_fixe'->>'valeur',
                ''
            )::TEXT as gps_coords,
            CASE 
                WHEN pm.gps IS NOT NULL AND pm.gps != '' AND position(',' in pm.gps) > 0 THEN
                    calculate_gps_distance_km(
                        lat, lng,
                        split_part(pm.gps, ',', 1)::DOUBLE PRECISION,
                        split_part(pm.gps, ',', 2)::DOUBLE PRECISION
                    )
                WHEN pm.service_data->>'gps_fixe' IS NOT NULL AND position(',' in (pm.service_data->>'gps_fixe')) > 0 THEN
                    calculate_gps_distance_km(
                        lat, lng,
                        split_part(pm.service_data->>'gps_fixe', ',', 1)::DOUBLE PRECISION,
                        split_part(pm.service_data->>'gps_fixe', ',', 2)::DOUBLE PRECISION
                    )
                ELSE NULL
            END::DOUBLE PRECISION as distance_km,
            pm.relevance_score,
            CASE 
                WHEN pm.gps IS NOT NULL AND pm.gps != '' THEN 'gps_column'::TEXT
                WHEN pm.service_data->>'gps_fixe' IS NOT NULL THEN 'gps_fixe'::TEXT
                ELSE 'no_gps'::TEXT
            END as gps_source
        FROM products_matched pm
        WHERE pm.relevance_score > 0
        AND (
            -- Filtre par distance GPS
            CASE 
                WHEN pm.gps IS NOT NULL AND position(',' in pm.gps) > 0 THEN
                    calculate_gps_distance_km(
                        lat, lng,
                        split_part(pm.gps, ',', 1)::DOUBLE PRECISION,
                        split_part(pm.gps, ',', 2)::DOUBLE PRECISION
                    ) <= radius_adjusted
                WHEN pm.service_data->>'gps_fixe' IS NOT NULL AND position(',' in (pm.service_data->>'gps_fixe')) > 0 THEN
                    calculate_gps_distance_km(
                        lat, lng,
                        split_part(pm.service_data->>'gps_fixe', ',', 1)::DOUBLE PRECISION,
                        split_part(pm.service_data->>'gps_fixe', ',', 2)::DOUBLE PRECISION
                    ) <= radius_adjusted
                ELSE false
            END
        )
        ORDER BY pm.relevance_score DESC, distance_km ASC NULLS LAST
        LIMIT max_results;
        
        RETURN;
    END IF;
    
    -- Fallback si pas de GPS : recherche sans GPS (même logique mais sans filtrage distance)
    RETURN QUERY
    WITH all_products_extracted AS (
        SELECT 
            s.id as service_id,
            s.data as service_data,
            s.created_at,
            s.user_id,
            s.gps,
            s.category,
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END as products_array
        FROM services s
        WHERE s.is_active = true
    ),
    products_matched AS (
        SELECT DISTINCT
            ape.service_id,
            ape.service_data,
            ape.created_at,
            ape.user_id,
            ape.gps,
            ape.category,
            GREATEST(
                COALESCE((
                    SELECT MAX(
                        CASE 
                            WHEN LOWER(extract_all_product_text(product)) = LOWER(search_query) THEN 25.0
                            WHEN LOWER(extract_all_product_text(product)) LIKE LOWER(search_query) || '%' THEN 18.0
                            WHEN LOWER(COALESCE(product->>'nom', '')) = LOWER(search_query) THEN 20.0
                            WHEN product->>'nom' ILIKE '%' || search_query || '%' THEN 12.0
                            WHEN product->>'categorie' ILIKE '%' || search_query || '%' THEN 10.0
                            WHEN product->>'description' ILIKE '%' || search_query || '%' THEN 8.0
                            WHEN extract_all_product_text(product) ILIKE '%' || search_query || '%' THEN 6.0
                            ELSE 0.0
                        END
                    )
                    FROM jsonb_array_elements(ape.products_array) AS product
                    WHERE (
                        extract_all_product_text(product) ILIKE '%' || search_query || '%'
                        OR product->>'nom' ILIKE '%' || search_query || '%'
                        OR product->>'categorie' ILIKE '%' || search_query || '%'
                        OR product->>'description' ILIKE '%' || search_query || '%'
                    )
                ), 0.0),
                CASE 
                    WHEN COALESCE(ape.service_data->>'titre_service', ape.service_data->'titre_service'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 10.0
                    WHEN COALESCE(ape.service_data->>'description', ape.service_data->'description'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 5.0
                    WHEN COALESCE(ape.service_data->>'category', ape.service_data->'category'->>'valeur', ape.category, '') ILIKE '%' || search_query || '%' THEN 8.0
                    ELSE 0.0
                END
            )::DOUBLE PRECISION as relevance_score
        FROM all_products_extracted ape
        WHERE (
            EXISTS (
                SELECT 1 
                FROM jsonb_array_elements(ape.products_array) AS product
                WHERE (
                    extract_all_product_text(product) ILIKE '%' || search_query || '%'
                    OR product->>'nom' ILIKE '%' || search_query || '%'
                    OR product->>'categorie' ILIKE '%' || search_query || '%'
                    OR product->>'description' ILIKE '%' || search_query || '%'
                )
            )
            OR COALESCE(ape.service_data->>'titre_service', ape.service_data->'titre_service'->>'valeur', '') ILIKE '%' || search_query || '%'
            OR COALESCE(ape.service_data->>'description', ape.service_data->'description'->>'valeur', '') ILIKE '%' || search_query || '%'
            OR COALESCE(ape.service_data->>'category', ape.service_data->'category'->>'valeur', ape.category, '') ILIKE '%' || search_query || '%'
        )
    )
    SELECT 
        pm.service_id::INTEGER,
        COALESCE(
            pm.service_data->>'titre_service',
            pm.service_data->'titre_service'->>'valeur',
            pm.service_data->>'titre',
            'Sans titre'
        )::TEXT as titre_service,
        COALESCE(
            pm.service_data->>'category',
            pm.service_data->'category'->>'valeur',
            pm.category,
            'Non catégorisé'
        )::TEXT as category,
        COALESCE(
            pm.gps,
            pm.service_data->>'gps_fixe',
            pm.service_data->'gps_fixe'->>'valeur',
            ''
        )::TEXT as gps_coords,
        0.0::DOUBLE PRECISION as distance_km,
        pm.relevance_score,
        CASE 
            WHEN pm.gps IS NOT NULL AND pm.gps != '' THEN 'gps_column'::TEXT
            WHEN pm.service_data->>'gps_fixe' IS NOT NULL THEN 'gps_fixe'::TEXT
            ELSE 'no_gps'::TEXT
        END as gps_source
    FROM products_matched pm
    WHERE pm.relevance_score > 0
    ORDER BY pm.relevance_score DESC, pm.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_services_gps_final(TEXT, TEXT, INTEGER, INTEGER) IS 
'Recherche de services avec filtrage GPS et recherche dans les produits (GÉNÉRIQUE). Extrait TOUS les produits AVANT de filtrer, utilise extract_all_product_text() pour rechercher dans TOUS les champs du produit. Retourne exactement 7 colonnes: service_id, titre_service, category, gps_coords, distance_km, relevance_score, gps_source';


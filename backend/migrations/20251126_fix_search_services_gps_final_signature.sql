-- Migration: Correction de la signature de search_services_gps_final
-- Date: 2025-11-26
-- Description: Corrige l'erreur "structure of query does not match function result type"
--              en garantissant que la fonction retourne exactement les colonnes attendues par le code Rust
-- Compatible: SQLx offline mode

-- 1. Supprimer toutes les versions existantes de la fonction
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text);
DROP FUNCTION IF EXISTS search_services_gps_final(text);
DROP FUNCTION IF EXISTS search_services_gps_final();

-- 2. Recréer la fonction avec la signature exacte attendue par le code Rust
-- Le code Rust attend exactement ces colonnes dans cet ordre:
-- service_id, titre_service, category, gps_coords, distance_km, relevance_score, gps_source

CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query text,
    user_gps_zone text,
    radius_km integer DEFAULT 50,
    max_results integer DEFAULT 100
)
RETURNS TABLE(
    service_id integer,
    titre_service text,
    category text,
    gps_coords text,
    distance_km double precision,
    relevance_score double precision,
    gps_source text
) AS $$
DECLARE
    gps_parts text[];
    lat double precision;
    lng double precision;
    radius_adjusted double precision;
BEGIN
    -- Ajuster le rayon
    BEGIN
        radius_adjusted := COALESCE(calculate_intelligent_radius(radius_km::double precision), radius_km::double precision);
    EXCEPTION
        WHEN OTHERS THEN
            radius_adjusted := radius_km::double precision;
    END;
    
    -- Extraire les coordonnées GPS si fournies
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' AND user_gps_zone != 'null' THEN
        -- Diviser par le séparateur "|" pour gérer les zones polygonales
        gps_parts := string_to_array(user_gps_zone, '|');
        
        -- Pour l'instant, utiliser le premier point comme centre de recherche
        IF array_length(gps_parts, 1) > 0 THEN
            -- Extraire lat,lng du premier point
            lat := split_part(gps_parts[1], ',', 1)::double precision;
            lng := split_part(gps_parts[1], ',', 2)::double precision;
            
            -- Recherche avec filtrage GPS et produits actifs
            RETURN QUERY
            WITH services_with_active_products AS (
                SELECT 
                    s.id,
                    s.data,
                    s.category,
                    s.gps,
                    s.is_active,
                    COALESCE(
                        get_best_gps_for_service(s.data),
                        s.gps,
                        '0,0'
                    ) as best_gps,
                    get_active_products(s.data, s.id) as active_products
                FROM services s
                WHERE s.is_active = TRUE
                    AND jsonb_array_length(get_active_products(s.data, s.id)) > 0
            ),
            scored_products AS (
                SELECT 
                    s.id as service_id,
                    COALESCE(
                        s.data->>'titre_service', 
                        s.data->'titre_service'->>'valeur', 
                        'Sans titre'
                    ) as titre_service,
                    COALESCE(
                        s.category, 
                        s.data->>'category', 
                        s.data->'category'->>'valeur',
                        'Non catégorisé'
                    ) as category,
                    s.best_gps as gps_coords,
                    CASE 
                        WHEN s.best_gps IS NOT NULL AND s.best_gps != '0,0' THEN
                            calculate_distance_km(user_gps_zone, s.best_gps)
                        ELSE 999999.0
                    END as distance_km,
                    -- Score basé principalement sur les PRODUITS
                    (
                        (
                            SELECT COALESCE(SUM(
                                CASE 
                                    WHEN product->>'nom' ILIKE '%' || search_query || '%' THEN 20.0
                                    WHEN product->>'name' ILIKE '%' || search_query || '%' THEN 20.0
                                    WHEN product->>'titre' ILIKE '%' || search_query || '%' THEN 18.0
                                    WHEN product->>'categorie' ILIKE '%' || search_query || '%' THEN 15.0
                                    WHEN product->>'description' ILIKE '%' || search_query || '%' THEN 12.0
                                    WHEN product->>'type' ILIKE '%' || search_query || '%' THEN 10.0
                                    WHEN product->>'marque' ILIKE '%' || search_query || '%' THEN 10.0
                                    ELSE 0.0
                                END
                            ), 0.0)
                            FROM jsonb_array_elements(s.active_products) AS product
                        ) +
                        CASE 
                            WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 5.0
                            ELSE 0.0
                        END
                    )::double precision as relevance_score,
                    CASE 
                        WHEN s.best_gps = get_best_gps_for_service(s.data) THEN 'produit_gps'
                        ELSE 'service_gps'
                    END as gps_source
                FROM services_with_active_products s
                WHERE 
                    CASE 
                        WHEN s.best_gps IS NOT NULL AND s.best_gps != '0,0' THEN
                            calculate_distance_km(user_gps_zone, s.best_gps) <= radius_adjusted
                        ELSE FALSE
                    END
                    AND (
                        search_query IS NULL 
                        OR search_query = ''
                        OR EXISTS (
                            SELECT 1
                            FROM jsonb_array_elements(s.active_products) AS product
                            WHERE 
                                product->>'nom' ILIKE '%' || search_query || '%'
                                OR product->>'name' ILIKE '%' || search_query || '%'
                                OR product->>'titre' ILIKE '%' || search_query || '%'
                                OR product->>'categorie' ILIKE '%' || search_query || '%'
                                OR product->>'description' ILIKE '%' || search_query || '%'
                        )
                        OR s.data::TEXT ILIKE '%' || search_query || '%'
                    )
            )
            SELECT 
                sp.service_id,
                sp.titre_service,
                sp.category,
                sp.gps_coords,
                sp.distance_km,
                sp.relevance_score,
                sp.gps_source
            FROM scored_products sp
            WHERE sp.relevance_score > 0
            ORDER BY 
                sp.relevance_score DESC,
                sp.distance_km ASC
            LIMIT max_results;
            
            RETURN;
        END IF;
    END IF;
    
    -- Si pas de GPS, faire une recherche textuelle sur produits actifs uniquement
    RETURN QUERY
    WITH services_with_active_products AS (
        SELECT 
            s.id,
            s.data,
            s.category,
            s.gps,
            get_active_products(s.data, s.id) as active_products
        FROM services s
        WHERE s.is_active = TRUE
            AND jsonb_array_length(get_active_products(s.data, s.id)) > 0
    )
    SELECT 
        s.id as service_id,
        COALESCE(
            s.data->>'titre_service', 
            s.data->'titre_service'->>'valeur', 
            'Sans titre'
        ) as titre_service,
        COALESCE(
            s.category, 
            s.data->>'category', 
            s.data->'category'->>'valeur',
            'Non catégorisé'
        ) as category,
        COALESCE(
            get_best_gps_for_service(s.data),
            s.gps,
            '0,0'
        ) as gps_coords,
        0.0 as distance_km,
        (
            (
                SELECT COALESCE(SUM(
                    CASE 
                        WHEN product->>'nom' ILIKE '%' || search_query || '%' THEN 20.0
                        WHEN product->>'name' ILIKE '%' || search_query || '%' THEN 20.0
                        WHEN product->>'titre' ILIKE '%' || search_query || '%' THEN 18.0
                        WHEN product->>'categorie' ILIKE '%' || search_query || '%' THEN 15.0
                        WHEN product->>'description' ILIKE '%' || search_query || '%' THEN 12.0
                        WHEN product->>'type' ILIKE '%' || search_query || '%' THEN 10.0
                        WHEN product->>'marque' ILIKE '%' || search_query || '%' THEN 10.0
                        ELSE 0.0
                    END
                ), 0.0)
                FROM jsonb_array_elements(s.active_products) AS product
            ) +
            CASE 
                WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 5.0
                ELSE 0.0
            END
        )::double precision as relevance_score,
        'no_gps' as gps_source
    FROM services_with_active_products s
    WHERE 
        search_query IS NULL 
        OR search_query = ''
        OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(s.active_products) AS product
            WHERE 
                product->>'nom' ILIKE '%' || search_query || '%'
                OR product->>'name' ILIKE '%' || search_query || '%'
                OR product->>'titre' ILIKE '%' || search_query || '%'
                OR product->>'categorie' ILIKE '%' || search_query || '%'
                OR product->>'description' ILIKE '%' || search_query || '%'
        )
        OR s.data::TEXT ILIKE '%' || search_query || '%'
    ORDER BY relevance_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Commentaire pour documentation
COMMENT ON FUNCTION search_services_gps_final IS 'Recherche dans les PRODUITS actifs (via products_lifecycle), pas dans les services. Retourne uniquement les services qui ont au moins un produit actif correspondant à la recherche. Signature corrigée le 2025-11-26 pour correspondre exactement au code Rust.';


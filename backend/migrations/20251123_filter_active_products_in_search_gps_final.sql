-- Migration: Filtrer les produits désactivés dans search_services_gps_final
-- Date: 2025-11-23
-- Description: Modifier search_services_gps_final pour rechercher dans les PRODUITS actifs (table products_lifecycle) et non dans les services

-- 1. S'assurer que la fonction get_active_products existe
-- Amélioration: supporte les deux formats de produits (direct array ou nested valeur)
CREATE OR REPLACE FUNCTION get_active_products(service_data JSONB, p_service_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    active_products JSONB := '[]'::JSONB;
    product JSONB;
    product_idx INTEGER := 0;
    is_product_active BOOLEAN;
    produits_array JSONB;
BEGIN
    -- Déterminer le tableau de produits à utiliser
    IF jsonb_typeof(service_data->'produits') = 'array' THEN
        produits_array := service_data->'produits';
    ELSIF jsonb_typeof(service_data->'produits'->'valeur') = 'array' THEN
        produits_array := service_data->'produits'->'valeur';
    ELSE
        RETURN '[]'::JSONB;
    END IF;
    
    -- Itérer sur les produits
    FOR product IN SELECT * FROM jsonb_array_elements(produits_array)
    LOOP
        -- Vérifier si le produit est actif dans products_lifecycle
        -- Si pas d'entrée dans products_lifecycle, considérer comme actif (valeur par défaut)
        SELECT COALESCE(pl.is_active, TRUE) INTO is_product_active
        FROM products_lifecycle pl
        WHERE pl.service_id = p_service_id
            AND pl.product_index = product_idx;
        
        -- Ajouter seulement si actif
        IF is_product_active THEN
            active_products := active_products || jsonb_build_array(product);
        END IF;
        
        product_idx := product_idx + 1;
    END LOOP;
    
    RETURN active_products;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Modifier search_services_gps_final pour rechercher dans les PRODUITS actifs
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
    produits_array JSONB;
BEGIN
    -- Ajuster le rayon
    radius_adjusted := COALESCE(calculate_intelligent_radius(radius_km::double precision), radius_km::double precision);
    
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
                    -- Filtrer uniquement les services qui ont au moins un produit actif
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
                    -- Score basé principalement sur les PRODUITS (priorité maximale)
                    (
                        -- Score pour correspondance dans les PRODUITS actifs (priorité MAX)
                        (
                            SELECT COALESCE(SUM(
                                CASE 
                                    -- PRIORITÉ MAXIMALE: nom du produit
                                    WHEN product->>'nom' ILIKE '%' || search_query || '%' THEN 20.0
                                    WHEN product->>'name' ILIKE '%' || search_query || '%' THEN 20.0
                                    WHEN product->>'titre' ILIKE '%' || search_query || '%' THEN 18.0
                                    -- TRÈS IMPORTANT: catégorie du produit
                                    WHEN product->>'categorie' ILIKE '%' || search_query || '%' THEN 15.0
                                    WHEN product->>'categorieQuincaillerie' ILIKE '%' || search_query || '%' THEN 15.0
                                    WHEN product->>'categorieElectromenager' ILIKE '%' || search_query || '%' THEN 15.0
                                    -- IMPORTANT: description du produit
                                    WHEN product->>'description' ILIKE '%' || search_query || '%' THEN 12.0
                                    -- Autres champs produit
                                    WHEN product->>'type' ILIKE '%' || search_query || '%' THEN 10.0
                                    WHEN product->>'marque' ILIKE '%' || search_query || '%' THEN 10.0
                                    WHEN product->>'modele' ILIKE '%' || search_query || '%' THEN 8.0
                                    WHEN product->>'matiere' ILIKE '%' || search_query || '%' THEN 8.0
                                    WHEN product->>'couleur' ILIKE '%' || search_query || '%' THEN 6.0
                                    ELSE 0.0
                                END
                            ), 0.0)
                            FROM jsonb_array_elements(s.active_products) AS product
                        ) +
                        -- Score pour correspondance dans les champs SERVICE (priorité réduite)
                        CASE 
                            WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' 
                            OR s.data->'titre_service'->>'valeur' ILIKE '%' || search_query || '%' THEN 5.0
                            ELSE 0.0
                        END +
                        CASE 
                            WHEN s.data->>'description' ILIKE '%' || search_query || '%'
                            OR s.data->'description'->>'valeur' ILIKE '%' || search_query || '%' THEN 3.0
                            ELSE 0.0
                        END +
                        CASE 
                            WHEN s.data->>'category' ILIKE '%' || search_query || '%'
                            OR s.data->'category'->>'valeur' ILIKE '%' || search_query || '%' THEN 4.0
                            ELSE 0.0
                        END
                    )::double precision as relevance_score,
                    CASE 
                        WHEN s.best_gps = get_best_gps_for_service(s.data) THEN 'produit_gps'
                        ELSE 'service_gps'
                    END as gps_source
                FROM services_with_active_products s
                WHERE 
                    -- Filtrer par distance si GPS fourni
                    CASE 
                        WHEN s.best_gps IS NOT NULL AND s.best_gps != '0,0' THEN
                            calculate_distance_km(user_gps_zone, s.best_gps) <= radius_adjusted
                        ELSE FALSE
                    END
                    -- Au moins un produit actif qui correspond à la recherche
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
                                OR product->>'type' ILIKE '%' || search_query || '%'
                                OR product->>'marque' ILIKE '%' || search_query || '%'
                        )
                        -- OU correspondance dans les champs service (fallback)
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

-- Commentaires
COMMENT ON FUNCTION get_active_products IS 'Filtre et retourne uniquement les produits actifs (is_active = TRUE dans products_lifecycle). Par défaut, si pas d''entrée dans products_lifecycle, le produit est considéré comme actif.';
COMMENT ON FUNCTION search_services_gps_final IS 'Recherche dans les PRODUITS actifs (via products_lifecycle), pas dans les services. Retourne uniquement les services qui ont au moins un produit actif correspondant à la recherche.';


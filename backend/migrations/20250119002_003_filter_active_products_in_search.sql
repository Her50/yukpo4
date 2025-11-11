-- Migration: Filtrer les produits désactivés dans les résultats de recherche
-- Date: 2025-01-19
-- Description: Modifier les fonctions de recherche pour exclure les produits dont is_active = FALSE

-- 1. Fonction helper pour filtrer les produits actifs d'un service
CREATE OR REPLACE FUNCTION get_active_products(service_data JSONB, p_service_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    active_products JSONB := '[]'::JSONB;
    product JSONB;
    product_idx INTEGER := 0;
    is_product_active BOOLEAN;
BEGIN
    -- Si pas de produits, retourner tableau vide
    IF jsonb_typeof(service_data->'produits') != 'array' THEN
        RETURN '[]'::JSONB;
    END IF;
    
    -- Itérer sur les produits
    FOR product IN SELECT * FROM jsonb_array_elements(service_data->'produits')
    LOOP
        -- Vérifier si le produit est actif dans products_lifecycle
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

-- 2. Mettre à jour search_services_gps_enhanced pour filtrer les produits actifs
CREATE OR REPLACE FUNCTION search_services_gps_enhanced_v2(
    search_query TEXT,
    user_gps_zone TEXT,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE(
    service_id INTEGER,
    titre_service TEXT,
    category TEXT,
    gps_coords TEXT,
    distance_km DOUBLE PRECISION,
    relevance_score FLOAT,
    gps_source TEXT,
    active_products_count INTEGER
) AS $$
BEGIN
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' THEN
        RETURN QUERY
        WITH service_with_best_gps AS (
            SELECT 
                s.id,
                s.data,
                s.category,
                s.gps as service_gps_realtime,
                COALESCE(
                    get_best_gps_for_service(s.data),
                    s.gps,
                    '0,0'
                ) as best_gps,
                -- Compter uniquement les produits actifs
                (
                    SELECT COUNT(*)
                    FROM jsonb_array_elements_text(get_active_products(s.data, s.id))
                ) as active_products_count
            FROM services s
            WHERE s.is_active = TRUE
        ),
        scored_services AS (
            SELECT 
                sg.id as service_id,
                COALESCE(sg.data->>'titre_service', sg.data->'titre_service'->>'valeur', 'Service sans titre') as titre_service,
                COALESCE(sg.category, sg.data->>'category', sg.data->'category'->>'valeur') as category,
                sg.best_gps as gps_coords,
                CASE 
                    WHEN sg.best_gps IS NOT NULL AND sg.best_gps != '0,0' THEN
                        calculate_distance_km(user_gps_zone, sg.best_gps)
                    ELSE 999999.0
                END as distance_km,
                -- Score avec filtrage sur produits actifs uniquement
                (
                    CASE 
                        WHEN sg.data->>'titre_service' ILIKE '%' || search_query || '%' 
                        OR sg.data->'titre_service'->>'valeur' ILIKE '%' || search_query || '%'
                        THEN 10.0
                        ELSE 0.0
                    END +
                    CASE 
                        WHEN sg.data->>'description' ILIKE '%' || search_query || '%'
                        OR sg.data->'description'->>'valeur' ILIKE '%' || search_query || '%'
                        THEN 7.0
                        ELSE 0.0
                    END +
                    -- MODIFIÉ: Chercher seulement dans les produits ACTIFS
                    (
                        SELECT COALESCE(SUM(
                            CASE 
                                WHEN product->>'nom' ILIKE '%' || search_query || '%' THEN 8.0
                                WHEN product->>'type' ILIKE '%' || search_query || '%' THEN 6.0
                                WHEN product->>'marque' ILIKE '%' || search_query || '%' THEN 5.0
                                ELSE 0.0
                            END
                        ), 0.0)
                        FROM jsonb_array_elements(get_active_products(sg.data, sg.id)) AS product
                    )
                )::FLOAT as relevance_score,
                CASE 
                    WHEN sg.best_gps = get_best_gps_for_service(sg.data) THEN 'produit_gps'
                    ELSE 'service_gps'
                END as gps_source,
                sg.active_products_count::INTEGER
            FROM service_with_best_gps sg
            WHERE 
                -- Filtre distance
                CASE 
                    WHEN sg.best_gps IS NOT NULL AND sg.best_gps != '0,0' THEN
                        calculate_distance_km(user_gps_zone, sg.best_gps) <= search_radius_km
                    ELSE FALSE
                END
                -- Filtre pertinence: au moins 1 produit actif qui match OU service qui match
                AND (
                    search_query IS NULL 
                    OR search_query = ''
                    OR sg.data::TEXT ILIKE '%' || search_query || '%'
                    OR jsonb_array_length(get_active_products(sg.data, sg.id)) > 0
                )
                -- Exclure services sans produits actifs si recherche produits
                AND sg.active_products_count > 0
        )
        SELECT 
            ss.service_id,
            ss.titre_service,
            ss.category,
            ss.gps_coords,
            ss.distance_km,
            ss.relevance_score,
            ss.gps_source,
            ss.active_products_count
        FROM scored_services ss
        WHERE ss.relevance_score > 0
        ORDER BY 
            ss.relevance_score DESC,
            ss.distance_km ASC
        LIMIT max_results;
    ELSE
        -- Recherche sans GPS (fallback textuel)
        RETURN QUERY
        SELECT 
            s.id as service_id,
            COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', 'Service sans titre') as titre_service,
            COALESCE(s.category, s.data->>'category', s.data->'category'->>'valeur') as category,
            COALESCE(get_best_gps_for_service(s.data), s.gps, '0,0') as gps_coords,
            0.0 as distance_km,
            10.0::FLOAT as relevance_score,
            'no_gps_search' as gps_source,
            (
                SELECT COUNT(*)
                FROM jsonb_array_elements_text(get_active_products(s.data, s.id))
            )::INTEGER as active_products_count
        FROM services s
        WHERE s.is_active = TRUE
            AND s.data::TEXT ILIKE '%' || search_query || '%'
            AND (
                SELECT COUNT(*)
                FROM jsonb_array_elements_text(get_active_products(s.data, s.id))
            ) > 0
        ORDER BY relevance_score DESC
        LIMIT max_results;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Modifier ResultatBesoinScreen pour filtrer côté client aussi (sécurité)
-- Note: Ceci sera fait dans le code TypeScript

-- Commentaires
COMMENT ON FUNCTION get_active_products IS 'Filtre et retourne uniquement les produits actifs (is_active = TRUE dans products_lifecycle)';
COMMENT ON FUNCTION search_services_gps_enhanced_v2 IS 'Version améliorée qui exclut automatiquement les produits désactivés des résultats de recherche';


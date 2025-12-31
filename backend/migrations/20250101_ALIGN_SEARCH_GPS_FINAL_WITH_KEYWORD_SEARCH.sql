-- Migration: Aligner search_services_gps_final avec la logique de keyword_search_with_gps
-- Date: 2025-01-01
-- Description: 
--  1. Utiliser la même logique de recherche que keyword_search_with_gps (autocomplete, produits, unaccent, similarity)
--  2. Inclure recherche dans produits et sous-caractéristiques
--  3. Gérer accents, erreurs de saisie, troncature comme la requête optimisée

DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);

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
    -- Ajuster le rayon
    BEGIN
        radius_adjusted := COALESCE(calculate_intelligent_radius(search_radius_km::double precision), search_radius_km::double precision);
    EXCEPTION WHEN OTHERS THEN
        radius_adjusted := search_radius_km::double precision;
    END;

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
                -- ✅ ALIGNÉ 2025-01-01: Utiliser la même logique que keyword_search_with_gps
                RETURN QUERY
                WITH autocomplete_matches AS (
                    -- ✅ ÉTAPE 1: Matches depuis autocomplete_characteristics (rapide, indexé)
                    SELECT 
                        ac.service_id,
                        ac.valeur,
                        ac.usage_count,
                        (
                            CASE WHEN LOWER(unaccent(ac.valeur)) = LOWER(unaccent(search_query)) THEN 100.0 ELSE 0.0 END +
                            CASE WHEN unaccent(ac.valeur) ILIKE unaccent(search_query) || '%' THEN 80.0 ELSE 0.0 END +
                            CASE WHEN unaccent(ac.valeur) ILIKE '%' || unaccent(search_query) || '%' THEN 60.0 ELSE 0.0 END +
                            ts_rank(to_tsvector('french', unaccent(ac.valeur)), plainto_tsquery('french', unaccent(search_query))) * 20.0 +
                            CASE WHEN similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER(search_query))) > 0.3 THEN 
                                similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER(search_query))) * 15.0 
                            ELSE 0.0 END +
                            (ac.usage_count::REAL * 0.5)
                        )::REAL as ac_score
                    FROM autocomplete_characteristics ac
                    INNER JOIN services s ON s.id = ac.service_id
                    WHERE s.is_active = true
                    AND ac.identifiant_base = 'produits'
                    AND ac.is_real_product = TRUE
                    AND (
                        LOWER(unaccent(ac.valeur)) = LOWER(unaccent(search_query))
                        OR unaccent(ac.valeur) ILIKE unaccent(search_query) || '%'
                        OR unaccent(ac.valeur) ILIKE '%' || unaccent(search_query) || '%'
                        OR to_tsvector('french', unaccent(ac.valeur)) @@ plainto_tsquery('french', unaccent(search_query))
                        OR similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER(search_query))) > 0.3
                    )
                    LIMIT 200
                ),
                best_autocomplete_per_service AS (
                    SELECT DISTINCT ON (service_id)
                        service_id,
                        ac_score
                    FROM autocomplete_matches
                    ORDER BY service_id, ac_score DESC, usage_count DESC NULLS LAST
                    LIMIT 100
                ),
                prefiltered_services_for_products AS (
                    -- ✅ Pré-filtrer services AVANT de décomposer produits
                    SELECT DISTINCT s.id
                    FROM services s
                    WHERE s.is_active = true
                    AND (
                        to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
                        OR to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
                        OR (COALESCE(s.data->'titre_service'->>'valeur', '')) % search_query
                        OR (COALESCE(s.data->'category'->>'valeur', s.category, '')) % search_query
                    )
                    LIMIT 200
                ),
                product_scores AS (
                    -- ✅ Pré-calculer scores produits SEULEMENT pour services pré-filtrés
                    SELECT 
                        s.id as service_id,
                        GREATEST(
                            CASE WHEN LOWER(unaccent(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', ''))) = LOWER(unaccent(search_query)) THEN 100.0 ELSE 0.0 END,
                            CASE WHEN unaccent(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', '')) ILIKE unaccent(search_query) || '%' THEN 80.0 ELSE 0.0 END,
                            CASE WHEN unaccent(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%' THEN 40.0 ELSE 0.0 END,
                            CASE WHEN LOWER(unaccent(COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', ''))) = LOWER(unaccent(search_query)) THEN 55.0 ELSE 0.0 END,
                            CASE WHEN unaccent(COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', '')) ILIKE unaccent(search_query) || '%' THEN 45.0 ELSE 0.0 END,
                            CASE WHEN unaccent(COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%' THEN 35.0 ELSE 0.0 END,
                            CASE WHEN unaccent(extract_all_product_text(product)) ILIKE '%' || unaccent(search_query) || '%' THEN 30.0 ELSE 0.0 END,
                            CASE WHEN to_tsvector('french', COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', '')) @@ plainto_tsquery('french', search_query) THEN 25.0 ELSE 0.0 END,
                            CASE WHEN to_tsvector('french', COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query) THEN 20.0 ELSE 0.0 END,
                            CASE WHEN to_tsvector('french', extract_all_product_text(product)) @@ plainto_tsquery('french', search_query) THEN 15.0 ELSE 0.0 END,
                            CASE WHEN similarity(unaccent(LOWER(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', ''))), unaccent(LOWER(search_query))) > 0.3 THEN 
                                similarity(unaccent(LOWER(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', ''))), unaccent(LOWER(search_query))) * 12.0 
                            ELSE 0.0 END
                        )::REAL as product_score
                    FROM prefiltered_services_for_products pf
                    INNER JOIN services s ON s.id = pf.id
                    CROSS JOIN LATERAL jsonb_array_elements(
                        CASE 
                            WHEN jsonb_typeof(s.data->'produits') = 'array' 
                            THEN s.data->'produits'
                            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                            THEN s.data->'produits'->'valeur'
                            ELSE '[]'::jsonb
                        END
                    ) AS product
                    WHERE (
                        unaccent(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%'
                        OR unaccent(COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%'
                        OR unaccent(extract_all_product_text(product)) ILIKE '%' || unaccent(search_query) || '%'
                        OR to_tsvector('french', COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
                        OR to_tsvector('french', COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
                        OR to_tsvector('french', extract_all_product_text(product)) @@ plainto_tsquery('french', search_query)
                        OR similarity(unaccent(LOWER(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', ''))), unaccent(LOWER(search_query))) > 0.3
                        OR similarity(unaccent(LOWER(COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', ''))), unaccent(LOWER(search_query))) > 0.3
                    )
                    LIMIT 500
                ),
                best_product_per_service AS (
                    SELECT DISTINCT ON (service_id)
                        service_id,
                        MAX(product_score) as max_product_score
                    FROM product_scores
                    GROUP BY service_id
                    ORDER BY service_id, max_product_score DESC
                    LIMIT 100
                ),
                services_with_distance AS (
                    SELECT 
                        s.id,
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
                            COALESCE(ac.ac_score, 0.0),
                            COALESCE(bp.max_product_score, 0.0),
                            CASE 
                                WHEN LOWER(unaccent(COALESCE(s.data->'titre_service'->>'valeur', ''))) = LOWER(unaccent(search_query)) THEN 70.0
                                WHEN unaccent(COALESCE(s.data->'titre_service'->>'valeur', '')) ILIKE unaccent(search_query) || '%' THEN 60.0
                                WHEN unaccent(COALESCE(s.data->'titre_service'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%' THEN 30.0
                                WHEN similarity(unaccent(LOWER(COALESCE(s.data->'titre_service'->>'valeur', ''))), unaccent(LOWER(search_query))) > 0.3 THEN 
                                    similarity(unaccent(LOWER(COALESCE(s.data->'titre_service'->>'valeur', ''))), unaccent(LOWER(search_query))) * 30.0
                                ELSE 0.0
                            END,
                            CASE 
                                WHEN unaccent(COALESCE(s.data->'category'->>'valeur', s.category, '')) ILIKE '%' || unaccent(search_query) || '%' THEN 50.0
                                WHEN unaccent(COALESCE(s.data->'description'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%' THEN 5.0
                                ELSE 0.0
                            END
                        )::REAL as relevance_score,
                        (CASE 
                            WHEN s.gps IS NOT NULL AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN 'service_gps'
                            ELSE 'no_gps'
                        END)::text AS gps_source
                    FROM services s
                    LEFT JOIN best_autocomplete_per_service ac ON ac.service_id = s.id
                    LEFT JOIN best_product_per_service bp ON bp.service_id = s.id
                    WHERE s.is_active = true
                    AND (
                        ac.service_id IS NOT NULL
                        OR bp.service_id IS NOT NULL
                        OR to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
                        OR (COALESCE(s.data->'titre_service'->>'valeur', '')) % search_query
                        OR (COALESCE(s.data->'category'->>'valeur', s.category, '')) % search_query
                        OR unaccent(COALESCE(s.data->'titre_service'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%'
                        OR unaccent(COALESCE(s.data->'category'->>'valeur', s.category, '')) ILIKE '%' || unaccent(search_query) || '%'
                    )
                )
                SELECT DISTINCT ON (id)
                    id::integer AS service_id,
                    titre_service,
                    category,
                    gps_coords,
                    distance_km,
                    relevance_score,
                    gps_source
                FROM services_with_distance
                WHERE distance_km IS NULL OR distance_km <= radius_adjusted
                ORDER BY id, relevance_score DESC
                LIMIT max_results;
                
                RETURN;
            END IF;
        END IF;
    END IF;

    -- CAS 2: Recherche SANS GPS (même logique mais sans calcul distance)
    -- ✅ ALIGNÉ 2025-01-01: Utiliser la même logique que keyword_search_with_gps
    RETURN QUERY
    WITH autocomplete_matches AS (
        SELECT 
            ac.service_id,
            ac.valeur,
            ac.usage_count,
            (
                CASE WHEN LOWER(unaccent(ac.valeur)) = LOWER(unaccent(search_query)) THEN 100.0 ELSE 0.0 END +
                CASE WHEN unaccent(ac.valeur) ILIKE unaccent(search_query) || '%' THEN 80.0 ELSE 0.0 END +
                CASE WHEN unaccent(ac.valeur) ILIKE '%' || unaccent(search_query) || '%' THEN 60.0 ELSE 0.0 END +
                ts_rank(to_tsvector('french', unaccent(ac.valeur)), plainto_tsquery('french', unaccent(search_query))) * 20.0 +
                CASE WHEN similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER(search_query))) > 0.3 THEN 
                    similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER(search_query))) * 15.0 
                ELSE 0.0 END +
                (ac.usage_count::REAL * 0.5)
            )::REAL as ac_score
        FROM autocomplete_characteristics ac
        INNER JOIN services s ON s.id = ac.service_id
        WHERE s.is_active = true
        AND ac.identifiant_base = 'produits'
        AND ac.is_real_product = TRUE
        AND (
            LOWER(unaccent(ac.valeur)) = LOWER(unaccent(search_query))
            OR unaccent(ac.valeur) ILIKE unaccent(search_query) || '%'
            OR unaccent(ac.valeur) ILIKE '%' || unaccent(search_query) || '%'
            OR to_tsvector('french', unaccent(ac.valeur)) @@ plainto_tsquery('french', unaccent(search_query))
            OR similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER(search_query))) > 0.3
        )
        LIMIT 200
    ),
    best_autocomplete_per_service AS (
        SELECT DISTINCT ON (service_id)
            service_id,
            ac_score
        FROM autocomplete_matches
        ORDER BY service_id, ac_score DESC, usage_count DESC NULLS LAST
        LIMIT 100
    ),
    prefiltered_services_for_products AS (
        SELECT DISTINCT s.id
        FROM services s
        WHERE s.is_active = true
        AND (
            to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
            OR to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
            OR (COALESCE(s.data->'titre_service'->>'valeur', '')) % search_query
            OR (COALESCE(s.data->'category'->>'valeur', s.category, '')) % search_query
        )
        LIMIT 200
    ),
    product_scores AS (
        SELECT 
            s.id as service_id,
            GREATEST(
                CASE WHEN LOWER(unaccent(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', ''))) = LOWER(unaccent(search_query)) THEN 100.0 ELSE 0.0 END,
                CASE WHEN unaccent(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', '')) ILIKE unaccent(search_query) || '%' THEN 80.0 ELSE 0.0 END,
                CASE WHEN unaccent(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%' THEN 40.0 ELSE 0.0 END,
                CASE WHEN LOWER(unaccent(COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', ''))) = LOWER(unaccent(search_query)) THEN 55.0 ELSE 0.0 END,
                CASE WHEN unaccent(COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', '')) ILIKE unaccent(search_query) || '%' THEN 45.0 ELSE 0.0 END,
                CASE WHEN unaccent(COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%' THEN 35.0 ELSE 0.0 END,
                CASE WHEN unaccent(extract_all_product_text(product)) ILIKE '%' || unaccent(search_query) || '%' THEN 30.0 ELSE 0.0 END,
                CASE WHEN to_tsvector('french', COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', '')) @@ plainto_tsquery('french', search_query) THEN 25.0 ELSE 0.0 END,
                CASE WHEN to_tsvector('french', COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query) THEN 20.0 ELSE 0.0 END,
                CASE WHEN to_tsvector('french', extract_all_product_text(product)) @@ plainto_tsquery('french', search_query) THEN 15.0 ELSE 0.0 END,
                CASE WHEN similarity(unaccent(LOWER(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', ''))), unaccent(LOWER(search_query))) > 0.3 THEN 
                    similarity(unaccent(LOWER(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', ''))), unaccent(LOWER(search_query))) * 12.0 
                ELSE 0.0 END
            )::REAL as product_score
        FROM prefiltered_services_for_products pf
        INNER JOIN services s ON s.id = pf.id
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        ) AS product
        WHERE (
            unaccent(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%'
            OR unaccent(COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%'
            OR unaccent(extract_all_product_text(product)) ILIKE '%' || unaccent(search_query) || '%'
            OR to_tsvector('french', COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
            OR to_tsvector('french', COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
            OR to_tsvector('french', extract_all_product_text(product)) @@ plainto_tsquery('french', search_query)
            OR similarity(unaccent(LOWER(COALESCE(product->>'nom_produit', product->>'nom', product->'nom'->>'valeur', ''))), unaccent(LOWER(search_query))) > 0.3
            OR similarity(unaccent(LOWER(COALESCE(product->>'description_produit', product->>'description', product->'description'->>'valeur', ''))), unaccent(LOWER(search_query))) > 0.3
        )
        LIMIT 500
    ),
    best_product_per_service AS (
        SELECT DISTINCT ON (service_id)
            service_id,
            MAX(product_score) as max_product_score
        FROM product_scores
        GROUP BY service_id
        ORDER BY service_id, max_product_score DESC
        LIMIT 100
    )
    SELECT DISTINCT ON (s.id)
        s.id::integer AS service_id,
        COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '')::text AS titre_service,
        COALESCE(s.category, s.data->'category'->>'valeur', '')::text AS category,
        COALESCE(s.gps, '')::text AS gps_coords,
        NULL::double precision AS distance_km,
        GREATEST(
            COALESCE(ac.ac_score, 0.0),
            COALESCE(bp.max_product_score, 0.0),
            CASE 
                WHEN LOWER(unaccent(COALESCE(s.data->'titre_service'->>'valeur', ''))) = LOWER(unaccent(search_query)) THEN 70.0
                WHEN unaccent(COALESCE(s.data->'titre_service'->>'valeur', '')) ILIKE unaccent(search_query) || '%' THEN 60.0
                WHEN unaccent(COALESCE(s.data->'titre_service'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%' THEN 30.0
                WHEN similarity(unaccent(LOWER(COALESCE(s.data->'titre_service'->>'valeur', ''))), unaccent(LOWER(search_query))) > 0.3 THEN 
                    similarity(unaccent(LOWER(COALESCE(s.data->'titre_service'->>'valeur', ''))), unaccent(LOWER(search_query))) * 30.0
                ELSE 0.0
            END,
            CASE 
                WHEN unaccent(COALESCE(s.data->'category'->>'valeur', s.category, '')) ILIKE '%' || unaccent(search_query) || '%' THEN 50.0
                WHEN unaccent(COALESCE(s.data->'description'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%' THEN 5.0
                ELSE 0.0
            END
        )::REAL as relevance_score,
        ('text_search')::text AS gps_source
    FROM services s
    LEFT JOIN best_autocomplete_per_service ac ON ac.service_id = s.id
    LEFT JOIN best_product_per_service bp ON bp.service_id = s.id
    WHERE s.is_active = true
    AND (
        ac.service_id IS NOT NULL
        OR bp.service_id IS NOT NULL
        OR to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', search_query)
        OR (COALESCE(s.data->'titre_service'->>'valeur', '')) % search_query
        OR (COALESCE(s.data->'category'->>'valeur', s.category, '')) % search_query
        OR unaccent(COALESCE(s.data->'titre_service'->>'valeur', '')) ILIKE '%' || unaccent(search_query) || '%'
        OR unaccent(COALESCE(s.data->'category'->>'valeur', s.category, '')) ILIKE '%' || unaccent(search_query) || '%'
    )
    ORDER BY s.id, relevance_score DESC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION search_services_gps_final IS 
'✅ ALIGNÉ 2025-01-01: Utilise la même logique que keyword_search_with_gps (autocomplete, produits, unaccent, similarity).
Inclut recherche dans produits et sous-caractéristiques. Gère accents, erreurs de saisie, troncature.';


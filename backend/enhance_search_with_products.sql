-- Amélioration de la recherche pour inclure les produits
-- =====================================================

-- 1. Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS search_services_gps_final(TEXT, TEXT, INTEGER, INTEGER);

-- 2. Créer une nouvelle fonction qui inclut la recherche de produits
CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query TEXT DEFAULT NULL,
    user_gps_zone TEXT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 20
) RETURNS TABLE (
    service_id INTEGER,
    titre_service TEXT,
    category TEXT,
    gps_coords TEXT,
    distance_km DECIMAL,
    relevance_score FLOAT,
    gps_source TEXT
) AS $$
BEGIN
    -- Si pas de requête de recherche, faire une recherche GPS pure
    IF search_query IS NULL OR search_query = '' THEN
        RETURN QUERY
        SELECT 
            s.service_id,
            s.titre_service,
            s.category,
            s.gps_coords,
            s.distance_km,
            0.0::FLOAT as relevance_score,
            s.gps_source
        FROM fast_gps_search_with_user_fallback(user_gps_zone, search_radius_km, max_results) s;
    ELSE
        -- Recherche avec texte incluant les produits
        RETURN QUERY
        WITH search_results AS (
            SELECT DISTINCT
                s.id as service_id,
                COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', 'Service sans titre') as titre_service,
                COALESCE(s.category, s.data->>'category', s.data->'category'->>'valeur') as category,
                COALESCE(
                    s.data->>'gps_fixe',
                    s.data->'gps_fixe'->>'valeur',
                    s.gps,
                    '0,0'
                ) as gps_coords,
                CASE 
                    WHEN user_gps_zone IS NOT NULL AND user_gps_zone != '' THEN
                        calculate_distance_km(
                            user_gps_zone,
                            COALESCE(
                                s.data->>'gps_fixe',
                                s.data->'gps_fixe'->>'valeur',
                                s.gps,
                                '0,0'
                            )
                        )
                    ELSE 0.0
                END as distance_km,
                -- Score de pertinence amélioré incluant les produits
                (
                    -- Score pour le titre
                    CASE 
                        WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' 
                        OR s.data->'titre_service'->>'valeur' ILIKE '%' || search_query || '%'
                        THEN 10.0
                        ELSE 0.0
                    END +
                    -- Score pour la description
                    CASE 
                        WHEN s.data->>'description' ILIKE '%' || search_query || '%'
                        OR s.data->'description'->>'valeur' ILIKE '%' || search_query || '%'
                        THEN 8.0
                        ELSE 0.0
                    END +
                    -- Score pour la catégorie
                    CASE 
                        WHEN s.category ILIKE '%' || search_query || '%'
                        OR s.data->>'category' ILIKE '%' || search_query || '%'
                        OR s.data->'category'->>'valeur' ILIKE '%' || search_query || '%'
                        THEN 6.0
                        ELSE 0.0
                    END +
                    -- NOUVEAU: Score pour les noms de produits
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 
                            FROM jsonb_array_elements(
                                CASE 
                                    WHEN jsonb_typeof(s.data->'produits') = 'array' 
                                    THEN s.data->'produits'
                                    WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                                    THEN s.data->'produits'->'valeur'
                                    ELSE '[]'::jsonb
                                END
                            ) AS product
                            WHERE product->>'name' ILIKE '%' || search_query || '%'
                        ) THEN 12.0  -- Score élevé pour les produits
                        ELSE 0.0
                    END +
                    -- Score pour la récence (plus récent = score plus élevé)
                    CASE 
                        WHEN s.created_at > NOW() - INTERVAL '7 days' THEN 3.0
                        WHEN s.created_at > NOW() - INTERVAL '30 days' THEN 2.0
                        WHEN s.created_at > NOW() - INTERVAL '90 days' THEN 1.0
                        ELSE 0.0
                    END
                ) as relevance_score,
                CASE 
                    WHEN s.data->>'gps_fixe' IS NOT NULL OR s.data->'gps_fixe'->>'valeur' IS NOT NULL THEN 'gps_fixe'
                    WHEN s.gps IS NOT NULL THEN 'gps_mobile'
                    ELSE 'no_gps'
                END as gps_source
            FROM services s
            WHERE s.is_active = true
            AND (
                -- Recherche dans les champs principaux
                s.data->>'titre_service' ILIKE '%' || search_query || '%'
                OR s.data->'titre_service'->>'valeur' ILIKE '%' || search_query || '%'
                OR s.data->>'description' ILIKE '%' || search_query || '%'
                OR s.data->'description'->>'valeur' ILIKE '%' || search_query || '%'
                OR s.category ILIKE '%' || search_query || '%'
                OR s.data->>'category' ILIKE '%' || search_query || '%'
                OR s.data->'category'->>'valeur' ILIKE '%' || search_query || '%'
                -- NOUVEAU: Recherche dans les noms de produits
                OR EXISTS (
                    SELECT 1 
                    FROM jsonb_array_elements(
                        CASE 
                            WHEN jsonb_typeof(s.data->'produits') = 'array' 
                            THEN s.data->'produits'
                            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                            THEN s.data->'produits'->'valeur'
                            ELSE '[]'::jsonb
                        END
                    ) AS product
                    WHERE product->>'name' ILIKE '%' || search_query || '%'
                )
            )
            -- Filtrage GPS si spécifié
            AND (
                user_gps_zone IS NULL 
                OR user_gps_zone = ''
                OR calculate_distance_km(
                    user_gps_zone,
                    COALESCE(
                        s.data->>'gps_fixe',
                        s.data->'gps_fixe'->>'valeur',
                        s.gps,
                        '0,0'
                    )
                ) <= search_radius_km
            )
        )
        SELECT 
            sr.service_id,
            sr.titre_service,
            sr.category,
            sr.gps_coords,
            sr.distance_km,
            sr.relevance_score,
            sr.gps_source
        FROM search_results sr
        ORDER BY 
            sr.relevance_score DESC,
            sr.distance_km ASC,
            sr.service_id DESC
        LIMIT max_results;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Créer un index pour optimiser la recherche de produits
CREATE INDEX IF NOT EXISTS idx_services_products_gin 
ON services USING GIN (
    (
        CASE 
            WHEN jsonb_typeof(data->'produits') = 'array' 
            THEN data->'produits'
            WHEN jsonb_typeof(data->'produits'->'valeur') = 'array'
            THEN data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END
    )
);

-- 4. Créer un index trigram pour les noms de produits
CREATE INDEX IF NOT EXISTS idx_services_products_names_trgm 
ON services USING GIN (
    (
        SELECT string_agg(product->>'name', ' ')
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(data->'produits') = 'array' 
                THEN data->'produits'
                WHEN jsonb_typeof(data->'produits'->'valeur') = 'array'
                THEN data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        ) AS product
    ) gin_trgm_ops
);

-- 5. Test de la fonction
SELECT '=== TEST: Recherche avec produits ===' as test_name;

-- Test avec un terme qui pourrait être dans les produits
SELECT * FROM search_services_gps_final('t-shirt', NULL, 50, 5);

-- Test avec un terme dans le titre
SELECT * FROM search_services_gps_final('plomberie', NULL, 50, 5);

-- Test avec GPS
SELECT * FROM search_services_gps_final('réparation', '4.0483,9.7043', 10, 5);

SELECT '=== FIN DES TESTS ===' as test_name;






-- ✅ NOUVEAU 2025-01-XX: Améliorations de scalabilité pour recherche
-- Objectif: Gérer des millions d'interactions instantanément

-- =====================================================
-- 1. VUE MATÉRIALISÉE OPTIMISÉE POUR RECHERCHES
-- =====================================================

-- Vue matérialisée pour recherches fréquentes (recharge toutes les 2 minutes)
DROP MATERIALIZED VIEW IF EXISTS services_search_optimized CASCADE;

CREATE MATERIALIZED VIEW services_search_optimized AS
SELECT 
    s.id as service_id,
    s.user_id,
    s.data,
    s.is_active,
    s.category,
    s.gps,
    s.created_at,
    -- Pré-calculer le tsvector pour recherche full-text
    to_tsvector('french', 
        COALESCE(s.data->'titre_service'->>'valeur', '') || ' ' ||
        COALESCE(s.data->'description'->>'valeur', '') || ' ' ||
        COALESCE(s.category, '')
    ) as search_vector,
    -- Pré-calculer le texte de tous les produits
    COALESCE((
        SELECT string_agg(extract_all_product_text(product), ' ')
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        ) AS product
    ), '') as products_text,
    -- Pré-calculer le tsvector produits
    to_tsvector('french', 
        COALESCE((
            SELECT string_agg(extract_all_product_text(product), ' ')
            FROM jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(s.data->'produits') = 'array' 
                    THEN s.data->'produits'
                    ELSE '[]'::jsonb
                END
            ) AS product
        ), '')
    ) as products_vector
FROM services s
WHERE s.is_active = TRUE;

-- Index GIN sur tsvector (ultra-rapide)
CREATE INDEX idx_services_search_optimized_vector
ON services_search_optimized USING GIN (search_vector);

CREATE INDEX idx_services_search_optimized_products_vector
ON services_search_optimized USING GIN (products_vector);

-- Index composite pour filtres fréquents
CREATE INDEX idx_services_search_optimized_category_active
ON services_search_optimized (category, is_active, created_at DESC)
WHERE is_active = TRUE;

-- Index pour recherche GPS
CREATE INDEX idx_services_search_optimized_gps
ON services_search_optimized (gps)
WHERE gps IS NOT NULL AND gps != '0,0';

-- =====================================================
-- 2. INDEX SUPPLÉMENTAIRES POUR PERFORMANCE
-- =====================================================

-- Index GIN sur extract_all_product_text (pré-calculé)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_products_text_gin
ON services USING GIN (
    to_tsvector('french', 
        COALESCE((
            SELECT string_agg(extract_all_product_text(product), ' ')
            FROM jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(data->'produits') = 'array' 
                    THEN data->'produits'
                    ELSE '[]'::jsonb
                END
            ) AS product
        ), '')
    )
);

-- Index trigram pour recherche partielle (noms produits)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_products_name_trgm
ON services USING GIN (
    (
        SELECT string_agg(product->>'nom', ' ')
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(data->'produits') = 'array' 
                THEN data->'produits'
                ELSE '[]'::jsonb
            END
        ) AS product
    ) gin_trgm_ops
)
WHERE is_active = TRUE;

-- Index composite pour recherches GPS fréquentes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_gps_active_category
ON services (is_active, category, created_at DESC)
WHERE is_active = TRUE AND gps IS NOT NULL AND gps != '0,0';

-- Index sur autocomplete_characteristics pour recherche rapide
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_autocomplete_full_vector_gin
ON autocomplete_characteristics USING GIN (full_vector)
WHERE is_real_product = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_autocomplete_location_vector_gin
ON autocomplete_characteristics USING GIN (location_vector)
WHERE is_real_product = TRUE AND location_vector IS NOT NULL;

-- =====================================================
-- 3. FONCTION DE RECHARGE AUTOMATIQUE
-- =====================================================

-- Fonction de refresh automatique (appelée toutes les 2 minutes)
CREATE OR REPLACE FUNCTION refresh_services_search_optimized()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_optimized;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. FONCTION DE RECHERCHE OPTIMISÉE VIA VUE
-- =====================================================

-- Fonction de recherche ultra-rapide utilisant la vue matérialisée
CREATE OR REPLACE FUNCTION search_services_optimized(
    search_query TEXT,
    category_filter TEXT DEFAULT NULL,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE (
    service_id INTEGER,
    data JSONB,
    created_at TIMESTAMP,
    user_id INTEGER,
    gps TEXT,
    category TEXT,
    total_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sso.service_id,
        sso.data,
        sso.created_at,
        sso.user_id,
        sso.gps,
        sso.category,
        -- Score calculé rapidement depuis vue matérialisée
        (
            ts_rank(sso.search_vector, plainto_tsquery('french', search_query)) * 2.0 +
            ts_rank(sso.products_vector, plainto_tsquery('french', search_query)) * 3.0
        )::FLOAT as total_score
    FROM services_search_optimized sso
    WHERE sso.is_active = TRUE
    AND (category_filter IS NULL OR sso.category = category_filter)
    AND (
        sso.search_vector @@ plainto_tsquery('french', search_query)
        OR sso.products_vector @@ plainto_tsquery('french', search_query)
    )
    ORDER BY total_score DESC, sso.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 5. STATISTIQUES POUR OPTIMISEUR POSTGRESQL
-- =====================================================

-- Analyser les tables pour améliorer les plans d'exécution
ANALYZE services;
ANALYZE services_search_optimized;
ANALYZE autocomplete_characteristics;

-- =====================================================
-- 6. COMMENTAIRES
-- =====================================================

COMMENT ON MATERIALIZED VIEW services_search_optimized IS 
'Vue matérialisée pour cache de recherches fréquentes. Recharger toutes les 2 minutes pour performance optimale. Utiliser refresh_services_search_optimized().';

COMMENT ON FUNCTION search_services_optimized IS 
'Recherche ultra-rapide utilisant la vue matérialisée. Temps de réponse attendu: <10ms.';

-- =====================================================
-- 7. JOB AUTOMATIQUE (si pg_cron disponible)
-- =====================================================

-- Optionnel: Configurer un job cron pour refresh automatique
-- SELECT cron.schedule(
--     'refresh-search-optimized',
--     '*/2 * * * *', -- Toutes les 2 minutes
--     'SELECT refresh_services_search_optimized()'
-- );


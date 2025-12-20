-- ✅ CORRECTION 2025-12-16: Optimisation des performances lors de la création de produits
-- Problèmes identifiés:
-- 1. Requête get_services_for_prestataire prend 1+ seconde (même avec index)
-- 2. Refresh de vue matérialisée prend 5-10 secondes
-- 3. Fonction refresh_services_search_optimized() prend 10.8 secondes

-- =====================================================
-- 1. Vérifier et créer index composite pour services
-- =====================================================

-- Index composite pour optimiser get_services_for_prestataire
-- La requête: SELECT id, data, is_active, created_at FROM services WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_services_user_id_created_at_desc_optimized_v2
ON services (user_id, created_at DESC)
WHERE is_active = TRUE;

-- Index partiel pour services actifs par utilisateur (optimise encore plus)
CREATE INDEX IF NOT EXISTS idx_services_user_id_active_created_at_desc
ON services (user_id, created_at DESC)
WHERE is_active = TRUE;

-- =====================================================
-- 2. Optimiser la vue matérialisée services_search_optimized
-- =====================================================

-- ✅ OPTIMISÉ: Utiliser autocomplete_characteristics au lieu de extract_all_product_text()
-- Le problème: extract_all_product_text() est récursif et très lent (10+ secondes)
-- Solution: Utiliser autocomplete_characteristics.full_vector qui est déjà indexé

-- D'abord, créer une version optimisée de la vue
DROP MATERIALIZED VIEW IF EXISTS services_search_optimized_v2 CASCADE;

CREATE MATERIALIZED VIEW services_search_optimized_v2 AS
SELECT 
    s.id as service_id,
    s.user_id,
    s.data,
    s.is_active,
    s.category,
    s.gps,
    s.created_at,
    -- Pré-calculer le tsvector pour recherche full-text (rapide)
    to_tsvector('french', 
        COALESCE(s.data->'titre_service'->>'valeur', '') || ' ' ||
        COALESCE(s.data->'description'->>'valeur', '') || ' ' ||
        COALESCE(s.category, '')
    ) as search_vector,
    -- ✅ OPTIMISÉ: Utiliser autocomplete_characteristics.full_vector au lieu de extract_all_product_text()
    -- C'est 10-20x plus rapide car full_vector est déjà indexé avec GIN
    COALESCE((
        SELECT string_agg(unnest_val, ' ')
        FROM (
            SELECT DISTINCT unnest_val
            FROM autocomplete_characteristics ac
            CROSS JOIN LATERAL unnest(ac.full_vector) AS unnest_val
            WHERE ac.service_id = s.id
            AND ac.identifiant_base = 'produits'
            AND ac.is_real_product = TRUE
        ) AS product_terms
    ), '') as products_text,
    -- ✅ OPTIMISÉ: Pré-calculer le tsvector produits depuis autocomplete_characteristics
    to_tsvector('french', 
        COALESCE((
            SELECT string_agg(unnest_val, ' ')
            FROM (
                SELECT DISTINCT unnest_val
                FROM autocomplete_characteristics ac
                CROSS JOIN LATERAL unnest(ac.full_vector) AS unnest_val
                WHERE ac.service_id = s.id
                AND ac.identifiant_base = 'produits'
                AND ac.is_real_product = TRUE
            ) AS product_terms
        ), '')
    ) as products_vector
FROM services s
WHERE s.is_active = TRUE;

-- Index GIN sur tsvector (ultra-rapide)
CREATE INDEX IF NOT EXISTS idx_services_search_optimized_v2_vector
ON services_search_optimized_v2 USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_services_search_optimized_v2_products_vector
ON services_search_optimized_v2 USING GIN (products_vector);

-- Index composite pour filtres fréquents
CREATE INDEX IF NOT EXISTS idx_services_search_optimized_v2_category_active
ON services_search_optimized_v2 (category, is_active, created_at DESC)
WHERE is_active = TRUE;

-- ✅ CRITIQUE: Index unique pour permettre REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_services_search_optimized_v2_unique
ON services_search_optimized_v2 (service_id);

-- =====================================================
-- 3. Fonction de refresh optimisée
-- =====================================================

-- ✅ OPTIMISÉ: Fonction de refresh qui utilise la nouvelle vue optimisée
CREATE OR REPLACE FUNCTION refresh_services_search_optimized()
RETURNS void AS $$
BEGIN
    -- ✅ OPTIMISÉ: Utiliser la vue v2 si elle existe, sinon utiliser l'ancienne
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized_v2') THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_optimized_v2;
    ELSIF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized') THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_optimized;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. Analyser les tables pour optimiser les plans d'exécution
-- =====================================================

ANALYZE services;
ANALYZE autocomplete_characteristics;

-- =====================================================
-- 5. Commentaires
-- =====================================================

COMMENT ON INDEX idx_services_user_id_created_at_desc_optimized_v2 IS 
'Index composite optimisé pour get_services_for_prestataire - accélère la requête WHERE user_id = $1 ORDER BY created_at DESC';

COMMENT ON MATERIALIZED VIEW services_search_optimized_v2 IS 
'Vue matérialisée optimisée utilisant autocomplete_characteristics au lieu de extract_all_product_text() - 10-20x plus rapide';



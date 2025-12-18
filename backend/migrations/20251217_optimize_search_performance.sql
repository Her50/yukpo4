-- =====================================================
-- OPTIMISATIONS PERFORMANCE RECHERCHE MOBILE
-- Date: 2025-12-17
-- Problème: Requête /api/search/direct prend 5.1s
-- =====================================================

-- =====================================================
-- PHASE 1: INDEX GIN POUR RECHERCHE FULL-TEXT
-- =====================================================

-- Index GIN pour recherche full-text sur titre_service
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_titre_service_gin 
ON services USING GIN (
    to_tsvector('french', COALESCE(data->'titre_service'->>'valeur', ''))
)
WHERE is_active = true;

-- Index GIN pour recherche full-text sur description
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_description_gin 
ON services USING GIN (
    to_tsvector('french', COALESCE(data->'description'->>'valeur', ''))
)
WHERE is_active = true;

-- Index GIN pour recherche full-text sur category
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_category_gin 
ON services USING GIN (
    to_tsvector('french', COALESCE(data->'category'->>'valeur', ''))
)
WHERE is_active = true;

-- Index composite pour recherche combinée (OPTIMAL)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_fulltext_combined_gin 
ON services USING GIN (
    to_tsvector('french', 
        COALESCE(data->'titre_service'->>'valeur', '') || ' ' ||
        COALESCE(data->'description'->>'valeur', '') || ' ' ||
        COALESCE(data->'category'->>'valeur', '')
    )
)
WHERE is_active = true;

-- =====================================================
-- PHASE 2: INDEX SUR autocomplete_characteristics
-- =====================================================

-- Index GIN sur full_vector pour recherche rapide
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_autocomplete_full_vector_gin 
ON autocomplete_characteristics USING GIN (full_vector);

-- Index GIN sur characteristic_vector
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_autocomplete_characteristic_vector_gin 
ON autocomplete_characteristics USING GIN (characteristic_vector);

-- Index GIN sur valeur pour recherche tsvector
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_autocomplete_valeur_tsvector_gin 
ON autocomplete_characteristics USING GIN (
    to_tsvector('french', valeur)
)
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- Index composite pour filtres fréquents
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_autocomplete_product_search 
ON autocomplete_characteristics (
    identifiant_base, 
    is_real_product,
    service_id
) 
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- =====================================================
-- PHASE 3: INDEX SUR delivery_status_events
-- =====================================================

-- Index composite pour requêtes fréquentes (delivery_id + occurred_at)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_delivery_status_events_delivery_occurred 
ON delivery_status_events (delivery_id, occurred_at);

-- Index sur delivery_id seul (si pas déjà présent)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_delivery_status_events_delivery_id 
ON delivery_status_events (delivery_id);

-- =====================================================
-- PHASE 4: INDEX SUR services POUR FILTRES FRÉQUENTS
-- =====================================================

-- Index composite pour is_active + category
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_active_category 
ON services (is_active, category)
WHERE is_active = true;

-- Index sur gps pour recherches géographiques (si format standardisé)
-- Note: Nécessite que gps soit au format "lat,lng" ou utiliser PostGIS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_gps_btree 
ON services (gps)
WHERE is_active = true AND gps IS NOT NULL AND gps != '';

-- =====================================================
-- PHASE 5: ANALYSE DES TABLES POUR OPTIMISATION
-- =====================================================

-- Analyser les tables pour mettre à jour les statistiques
ANALYZE services;
ANALYZE autocomplete_characteristics;
ANALYZE delivery_status_events;

-- =====================================================
-- VÉRIFICATION DES INDEX CRÉÉS
-- =====================================================

-- Vérifier que les index ont été créés
SELECT 
    schemaname,
    tablename::text,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename::text IN ('services', 'autocomplete_characteristics', 'delivery_status_events')
AND indexname LIKE 'idx_%'
ORDER BY tablename::text, indexname;

-- =====================================================
-- STATISTIQUES SUR LES INDEX
-- =====================================================

-- Vérifier la taille des index
SELECT
    schemaname,
    tablename::text,
    indexrelname AS indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE tablename::text IN ('services', 'autocomplete_characteristics', 'delivery_status_events')
AND indexrelname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- =====================================================
-- NOTES D'UTILISATION
-- =====================================================

-- 1. Les index CONCURRENTLY peuvent prendre du temps à créer
--    Surveiller avec: SELECT * FROM pg_stat_progress_create_index;

-- 2. Après création des index, les requêtes devraient être plus rapides
--    Tester avec EXPLAIN ANALYZE sur les requêtes problématiques

-- 3. Les index GIN peuvent être volumineux mais sont très efficaces
--    pour les recherches full-text

-- 4. Surveiller l'utilisation des index avec:
--    SELECT * FROM pg_stat_user_indexes WHERE idx_scan > 0;

-- =====================================================
-- ROLLBACK (en cas de problème)
-- =====================================================

-- Pour supprimer les index si nécessaire:
/*
DROP INDEX CONCURRENTLY IF EXISTS idx_services_titre_service_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_services_description_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_services_category_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_services_fulltext_combined_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_autocomplete_full_vector_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_autocomplete_characteristic_vector_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_autocomplete_valeur_tsvector_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_autocomplete_product_search;
DROP INDEX CONCURRENTLY IF EXISTS idx_delivery_status_events_delivery_occurred;
DROP INDEX CONCURRENTLY IF EXISTS idx_delivery_status_events_delivery_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_services_active_category;
DROP INDEX CONCURRENTLY IF EXISTS idx_services_gps_btree;
*/


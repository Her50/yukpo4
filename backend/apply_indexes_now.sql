-- Script pour appliquer tous les index manquants pour optimiser get_services_for_prestataire
-- Base: yukpo_db sur Render
-- Date: 2025-11-27

-- ============================================
-- INDEX POUR SERVICES
-- ============================================

-- Index pour optimiser get_services_for_prestataire (requête par user_id)
CREATE INDEX IF NOT EXISTS idx_services_user_id_created_at 
ON services (user_id, created_at DESC)
WHERE is_active = true;

-- Index pour optimiser les recherches par is_active
CREATE INDEX IF NOT EXISTS idx_services_is_active_created_at 
ON services (is_active, created_at DESC);

-- Index composite pour les recherches avec filtres multiples
CREATE INDEX IF NOT EXISTS idx_services_user_active_created 
ON services (user_id, is_active, created_at DESC);

-- Index pour optimiser les recherches JSONB sur data->'produits'
-- Utilise GIN pour les recherches dans les tableaux JSONB
CREATE INDEX IF NOT EXISTS idx_services_data_produits_gin 
ON services USING GIN ((data->'produits'));

-- Index pour optimiser les recherches sur category
CREATE INDEX IF NOT EXISTS idx_services_category_active 
ON services (category, is_active) 
WHERE category IS NOT NULL;

-- Index alternatif (migration 20251126)
CREATE INDEX IF NOT EXISTS idx_services_user_id_created_at_desc 
ON services(user_id, created_at DESC) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_services_user_id_is_active_created_at 
ON services(user_id, is_active, created_at DESC);

-- ============================================
-- INDEX POUR PRODUCTS_LIFECYCLE
-- ============================================

-- Index composite pour la jointure service_id + product_index
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_product 
ON products_lifecycle (service_id, product_index);

-- Index composite incluant is_active
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_product_active 
ON products_lifecycle (service_id, product_index, is_active);

-- ============================================
-- COMMENTAIRES POUR DOCUMENTATION
-- ============================================

COMMENT ON INDEX IF EXISTS idx_services_user_id_created_at IS 'Optimise get_services_for_prestataire - requête par user_id avec tri created_at';
COMMENT ON INDEX IF EXISTS idx_services_is_active_created_at IS 'Optimise les recherches de services actifs triés par date';
COMMENT ON INDEX IF EXISTS idx_services_user_active_created IS 'Index composite pour requêtes fréquentes avec user_id + is_active';
COMMENT ON INDEX IF EXISTS idx_services_data_produits_gin IS 'Index GIN pour recherches rapides dans les produits JSONB';
COMMENT ON INDEX IF EXISTS idx_services_category_active IS 'Optimise les recherches par catégorie avec filtre actif';
COMMENT ON INDEX IF EXISTS idx_products_lifecycle_service_product IS 'Index composite pour optimiser les jointures LEFT JOIN dans get_services_for_prestataire';
COMMENT ON INDEX IF EXISTS idx_products_lifecycle_service_product_active IS 'Index composite incluant is_active pour éviter les sous-requêtes supplémentaires';

-- ============================================
-- MISE À JOUR DES STATISTIQUES
-- ============================================

ANALYZE services;
ANALYZE products_lifecycle;

-- ============================================
-- VÉRIFICATION
-- ============================================

-- Afficher les index créés
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('services', 'products_lifecycle')
  AND (
    indexname LIKE '%user_id%created_at%'
    OR indexname LIKE '%services_user_id%'
    OR indexname LIKE '%services_data_produits%'
    OR indexname LIKE '%services_category%'
    OR indexname LIKE '%products_lifecycle_service_product%'
  )
ORDER BY tablename, indexname;


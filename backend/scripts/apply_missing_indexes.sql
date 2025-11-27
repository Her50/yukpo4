-- Script pour appliquer manuellement les index manquants
-- À utiliser si les migrations ne s'exécutent pas automatiquement

-- Index pour optimiser get_services_for_prestataire (requête par user_id)
-- Migration: 20251127_120004_optimize_services_queries_indexes.sql
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

-- Index pour products_lifecycle (migration: 20251127_optimize_get_services_performance.sql)
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_product 
ON products_lifecycle (service_id, product_index);

CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_product_active 
ON products_lifecycle (service_id, product_index, is_active);

-- Mettre à jour les statistiques pour que PostgreSQL utilise les nouveaux index
ANALYZE services;
ANALYZE products_lifecycle;

-- Vérifier que les index ont été créés
SELECT 
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


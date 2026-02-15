-- Migration pour optimiser les requêtes lentes identifiées dans les logs
-- Date: 2025-11-28
-- Description: Optimise /api/prestataire/services et /api/services/create

-- ✅ OPTIMISATION 1: Index composite pour get_services_for_prestataire
-- Améliore la requête WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_services_user_id_created_at_desc_optimized 
ON services (user_id, created_at DESC)
WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_services_user_id_created_at_desc_optimized IS 
'Index optimisé pour get_services_for_prestataire - tri par user_id et created_at DESC';

-- ✅ OPTIMISATION 2: Index partiel pour products_lifecycle (requêtes fréquentes)
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_product_optimized
ON products_lifecycle (service_id, product_index)
WHERE service_id IS NOT NULL AND product_index IS NOT NULL;

COMMENT ON INDEX idx_products_lifecycle_service_product_optimized IS 
'Index optimisé pour jointures avec products_lifecycle dans get_services_for_prestataire';

-- ✅ OPTIMISATION 3: Index GIN pour recherches rapides dans data->produits
-- Améliore l'extraction de produits depuis services.data
CREATE INDEX IF NOT EXISTS idx_services_data_produits_extraction_gin
ON services USING GIN ((data->'produits'))
WHERE data->'produits' IS NOT NULL;

COMMENT ON INDEX idx_services_data_produits_extraction_gin IS 
'Index GIN pour extraction rapide des produits depuis services.data';

-- ✅ OPTIMISATION 4: Index pour data->titre_service et data->description (extraction fréquente)
CREATE INDEX IF NOT EXISTS idx_services_data_titre_service_gin
ON services USING GIN ((data->'titre_service'))
WHERE data->'titre_service' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_services_data_description_gin
ON services USING GIN ((data->'description'))
WHERE data->'description' IS NOT NULL;

-- ✅ OPTIMISATION 5: Index pour UPDATE services SET data (creer_service)
-- Améliore les UPDATE fréquents sur services.data
CREATE INDEX IF NOT EXISTS idx_services_id_for_update
ON services (id)
WHERE id IS NOT NULL;

-- ✅ OPTIMISATION 6: Statistiques mises à jour pour le planificateur PostgreSQL
ANALYZE services;
ANALYZE products_lifecycle;

-- ✅ OPTIMISATION 7: Configuration pour améliorer les performances JSONB
-- Augmenter work_mem temporairement pour les requêtes complexes (si nécessaire)
-- Note: Cette configuration doit être faite au niveau de la session ou du serveur
-- ALTER SYSTEM SET work_mem = '64MB'; -- À faire manuellement si nécessaire

COMMENT ON TABLE services IS 
'Table services - Optimisée pour requêtes fréquentes get_services_for_prestataire et creer_service';


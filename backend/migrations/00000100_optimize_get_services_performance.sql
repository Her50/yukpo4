-- Migration: Optimisation des performances pour get_services_for_prestataire
-- Date: 2025-11-27
-- Description: Crée un index composite pour optimiser la jointure avec products_lifecycle

-- Index composite pour la jointure service_id + product_index (utilisé dans la CTE products_expanded)
-- Cet index permet une recherche ultra-rapide lors du LEFT JOIN
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_product 
ON products_lifecycle (service_id, product_index);

-- Index composite incluant is_active pour éviter les sous-requêtes supplémentaires
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_product_active 
ON products_lifecycle (service_id, product_index, is_active);

-- Index sur user_id + created_at pour optimiser la requête principale (déjà existant mais on vérifie)
CREATE INDEX IF NOT EXISTS idx_services_user_id_created_at_desc 
ON services (user_id, created_at DESC);

-- Commentaires pour documentation
COMMENT ON INDEX idx_products_lifecycle_service_product IS 
'Index composite pour optimiser les jointures LEFT JOIN dans get_services_for_prestataire. Permet une recherche ultra-rapide de is_active par service_id + product_index.';

COMMENT ON INDEX idx_products_lifecycle_service_product_active IS 
'Index composite incluant is_active pour éviter les sous-requêtes supplémentaires lors du filtrage des produits actifs.';

-- Analyser la table pour mettre à jour les statistiques
ANALYZE products_lifecycle;
ANALYZE services;


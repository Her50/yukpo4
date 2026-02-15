-- Migration: Optimisations pour la création de produits
-- Date: 2025-01-27
-- Description: Ajoute index GIN sur services.data->'produits' pour améliorer les performances

-- ✅ OPTIMISATION 1: Index GIN sur services.data->'produits' pour requêtes JSONB rapides
CREATE INDEX IF NOT EXISTS idx_services_data_produits_gin 
ON services USING GIN ((data->'produits'));

COMMENT ON INDEX idx_services_data_produits_gin IS 
'Index GIN pour optimiser les requêtes sur les produits dans services.data. Améliore les performances lors de la recherche et de la mise à jour des produits.';

-- ✅ OPTIMISATION 2: Index composite sur media pour récupération rapide des médias d'un produit
CREATE INDEX IF NOT EXISTS idx_media_service_product_type 
ON media (service_id, product_index, type) 
WHERE product_index IS NOT NULL;

COMMENT ON INDEX idx_media_service_product_type IS 
'Index composite pour optimiser la récupération des médias d''un produit spécifique. Filtre sur product_index IS NOT NULL pour ne pas indexer les médias de service.';

-- ✅ OPTIMISATION 3: Index sur updated_at pour services (pour requêtes récentes)
CREATE INDEX IF NOT EXISTS idx_services_updated_at 
ON services (updated_at DESC) 
WHERE is_active = TRUE;

COMMENT ON INDEX idx_services_updated_at IS 
'Index pour optimiser les requêtes de services récemment mis à jour (utile pour dashboard, analytics).';

-- ✅ OPTIMISATION 4: Index partiel sur users.tokens_balance pour vérifications rapides
CREATE INDEX IF NOT EXISTS idx_users_tokens_balance_active 
ON users (tokens_balance) 
WHERE tokens_balance > 0;

COMMENT ON INDEX idx_users_tokens_balance_active IS 
'Index partiel pour optimiser les vérifications de solde lors de la création de produits. Ne couvre que les utilisateurs avec solde > 0.';

-- Analyser les tables pour mettre à jour les statistiques
ANALYZE services;
ANALYZE media;
ANALYZE users;


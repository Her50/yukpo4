-- Migration pour optimiser les requêtes SQL lentes sur la table services
-- Corrige les warnings "slow statement: execution time exceeded alert threshold"

-- Index pour optimiser get_services_for_prestataire (requête par user_id)
-- Cette requête est utilisée fréquemment et peut prendre >1s sans index
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

-- Commentaires pour documentation
COMMENT ON INDEX idx_services_user_id_created_at IS 'Optimise get_services_for_prestataire - requête par user_id avec tri created_at';
COMMENT ON INDEX idx_services_is_active_created_at IS 'Optimise les recherches de services actifs triés par date';
COMMENT ON INDEX idx_services_user_active_created IS 'Index composite pour requêtes fréquentes avec user_id + is_active';
COMMENT ON INDEX idx_services_data_produits_gin IS 'Index GIN pour recherches rapides dans les produits JSONB';
COMMENT ON INDEX idx_services_category_active IS 'Optimise les recherches par catégorie avec filtre actif';


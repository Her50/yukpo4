-- Migration: Optimisation des index pour user_saved_addresses
-- Date: 2025-01-07
-- Description: Ajout d'un index composite pour améliorer les performances de list_saved_addresses

-- Index composite optimisé pour la requête la plus fréquente
-- Couvre: user_id + is_active + address_type (pour le filtrage)
-- Inclut: is_default_pickup, is_default_dropoff, last_used_at (pour le tri)
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_query_optimized 
ON user_saved_addresses(user_id, is_active, address_type)
INCLUDE (is_default_pickup, is_default_dropoff, last_used_at, label);

-- Index pour le cas où address_type='both' (toutes les adresses)
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_all_types
ON user_saved_addresses(user_id, is_active)
INCLUDE (is_default_pickup, is_default_dropoff, last_used_at, label, address_type);

-- Commentaire
COMMENT ON INDEX idx_user_saved_addresses_query_optimized IS 
'Index composite optimisé pour list_saved_addresses avec filtrage par type';
COMMENT ON INDEX idx_user_saved_addresses_all_types IS 
'Index pour list_saved_addresses quand address_type=both (toutes les adresses)';


-- Migration: Ajouter storage_location_id à product_delivery_config
-- Date: 2026-01-30
-- Description: Ajoute la colonne storage_location_id pour référencer le lieu de stockage principal
-- ✅ Compatible AWS/Docker: Utilise IF NOT EXISTS pour éviter les erreurs si la colonne existe déjà
-- ✅ Aligné avec auto_migrate.rs ligne 10655: Utilise ON DELETE SET NULL pour cohérence

-- Ajouter la colonne storage_location_id si elle n'existe pas déjà
-- ✅ CORRIGÉ: Ajouter ON DELETE SET NULL pour cohérence avec auto_migrate.rs
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS storage_location_id INTEGER REFERENCES merchant_storage_locations(id) ON DELETE SET NULL;

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_storage_location 
ON product_delivery_config(storage_location_id) 
WHERE storage_location_id IS NOT NULL;


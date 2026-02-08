-- ============================================
-- Migrations pour Configuration de Livraison
-- Base de données: AWS PostgreSQL
-- ============================================

-- Migration 1: Ajouter preparation_time_minutes et colonnes associées
-- Date: 2025-01-20
-- Description: Ajoute colonnes pour temps de préparation et jours de disponibilité

-- 1. Ajouter colonnes à product_delivery_config
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER,
ADD COLUMN IF NOT EXISTS max_preparation_time_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS availability_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
ADD COLUMN IF NOT EXISTS is_immediately_available BOOLEAN DEFAULT FALSE;

-- 2. Index pour recherche par jours de disponibilité
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_availability_days 
ON product_delivery_config USING GIN(availability_days);

-- Migration 2: Ajouter storage_location_id
-- Date: 2026-01-30
-- Description: Ajoute la colonne storage_location_id pour référencer le lieu de stockage principal

-- Ajouter la colonne storage_location_id si elle n'existe pas déjà
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS storage_location_id INTEGER REFERENCES merchant_storage_locations(id) ON DELETE SET NULL;

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_storage_location 
ON product_delivery_config(storage_location_id) 
WHERE storage_location_id IS NOT NULL;

-- ============================================
-- Vérification: Afficher les colonnes créées
-- ============================================
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'product_delivery_config' 
AND column_name IN (
    'preparation_time_minutes', 
    'storage_location_id', 
    'max_preparation_time_minutes', 
    'availability_days', 
    'is_immediately_available'
)
ORDER BY column_name;

-- Vérification: Afficher les index créés
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'product_delivery_config'
AND indexname IN (
    'idx_product_delivery_config_availability_days',
    'idx_product_delivery_config_storage_location'
)
ORDER BY indexname;




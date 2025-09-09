-- Migration pour ajouter les colonnes d'interaction à la table services
-- Date: 2025-08-28

-- Ajouter les colonnes pour le scoring d'interaction
ALTER TABLE services ADD COLUMN IF NOT EXISTS interaction_count INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS rating_avg DECIMAL(3,2) DEFAULT 0.0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_services_interaction_count ON services(interaction_count);
CREATE INDEX IF NOT EXISTS idx_services_rating_avg ON services(rating_avg);
CREATE INDEX IF NOT EXISTS idx_services_rating_count ON services(rating_count);

-- Vérifier que les colonnes ont été ajoutées
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'services' 
AND column_name IN ('interaction_count', 'rating_avg', 'rating_count'); 
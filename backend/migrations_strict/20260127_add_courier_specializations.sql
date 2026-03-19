-- Migration pour ajouter les spécialisations de coursiers
-- Date: 2026-01-27

-- Ajouter colonne specializations dans courier_assets (JSONB pour stocker plusieurs spécialisations)
ALTER TABLE courier_assets 
ADD COLUMN IF NOT EXISTS specializations JSONB DEFAULT '[]'::jsonb;

-- Créer index pour recherche par spécialisation
CREATE INDEX IF NOT EXISTS idx_courier_assets_specializations 
ON courier_assets USING GIN (specializations);

-- Commentaire sur la colonne
COMMENT ON COLUMN courier_assets.specializations IS 'Tableau JSON des spécialisations du coursier (ex: ["food_shopping", "general_delivery", "heavy_items"])';


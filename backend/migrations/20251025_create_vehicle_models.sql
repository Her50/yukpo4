-- Migration: Créer table vehicle_models pour l'autocomplete des modèles de véhicules
-- Date: 2025-10-25
-- Description: Table pour stocker les modèles de véhicules par marque
--              (ex: Toyota Corolla, Honda Civic, etc.)
-- Note: Compatible avec SQLx offline mode

-- Vérifier et créer la table vehicle_models
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vehicle_models') THEN
        CREATE TABLE vehicle_models (
            id SERIAL PRIMARY KEY,
            brand VARCHAR(100) NOT NULL,
            model VARCHAR(100) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            CONSTRAINT unique_brand_model UNIQUE (brand, model)
        );
        
        RAISE NOTICE 'Table vehicle_models créée avec succès';
    ELSE
        RAISE NOTICE 'Table vehicle_models existe déjà';
    END IF;
END $$;

-- Index pour recherche rapide par marque
CREATE INDEX IF NOT EXISTS idx_vehicle_models_brand ON vehicle_models(brand);

-- Index pour recherche insensible à la casse
CREATE INDEX IF NOT EXISTS idx_vehicle_models_model_lower ON vehicle_models(LOWER(model));

-- Index combiné
CREATE INDEX IF NOT EXISTS idx_vehicle_models_brand_model ON vehicle_models(brand, model);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_vehicle_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_vehicle_models_updated_at ON vehicle_models;
CREATE TRIGGER trigger_vehicle_models_updated_at
    BEFORE UPDATE ON vehicle_models
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_models_updated_at();

-- Note: Pas de modèles par défaut
-- Les modèles seront ajoutés automatiquement au fur et à mesure 
-- que les utilisateurs créent leurs annonces automobiles.

-- Commentaires
COMMENT ON TABLE vehicle_models IS 'Modèles de véhicules pour l''autocomplete par marque';
COMMENT ON COLUMN vehicle_models.brand IS 'Marque du véhicule (Toyota, Honda, etc.)';
COMMENT ON COLUMN vehicle_models.model IS 'Modèle du véhicule (Corolla, Civic, etc.)';


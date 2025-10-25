-- Migration: Créer table phone_models pour l'autocomplete des modèles de smartphones
-- Date: 2025-10-25
-- Description: Table pour stocker les modèles de smartphones par marque
--              (ex: Apple iPhone 14 Pro, Samsung Galaxy S23, etc.)
-- Note: Compatible avec SQLx offline mode

-- Vérifier et créer la table phone_models
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'phone_models') THEN
        CREATE TABLE phone_models (
            id SERIAL PRIMARY KEY,
            brand VARCHAR(100) NOT NULL,
            model VARCHAR(200) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(brand, model)
        );

        -- Index pour recherche rapide par marque
        CREATE INDEX idx_phone_models_brand ON phone_models(brand);
        
        -- Index pour recherche rapide par modèle
        CREATE INDEX idx_phone_models_model ON phone_models(model);
        
        -- Index combiné pour recherches complexes
        CREATE INDEX idx_phone_models_brand_model ON phone_models(brand, model);

        RAISE NOTICE 'Table phone_models créée avec succès';
    ELSE
        RAISE NOTICE 'Table phone_models existe déjà, migration ignorée';
    END IF;
END $$;

-- Commentaires pour documentation
COMMENT ON TABLE phone_models IS 'Modèles de smartphones pour l''autocomplete par marque';
COMMENT ON COLUMN phone_models.brand IS 'Marque du smartphone (Apple, Samsung, Xiaomi, etc.)';
COMMENT ON COLUMN phone_models.model IS 'Modèle du smartphone (iPhone 14 Pro, Galaxy S23, etc.)';

-- Note: Pas de modèles par défaut
-- Les modèles seront ajoutés automatiquement au fur et à mesure 
-- que les utilisateurs créent leurs annonces de smartphones.



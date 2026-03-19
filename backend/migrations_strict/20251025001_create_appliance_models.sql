-- Migration : Création de la table appliance_models pour les modèles d'appareils électroménagers
-- Date : 2025-10-25
-- Compatible SQLx offline mode

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appliance_models') THEN
        CREATE TABLE appliance_models (
            id SERIAL PRIMARY KEY,
            brand VARCHAR(255) NOT NULL,
            model VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(brand, model)
        );

        -- Index pour recherche rapide par marque
        CREATE INDEX idx_appliance_models_brand ON appliance_models(brand);
        
        -- Index pour recherche rapide par modèle
        CREATE INDEX idx_appliance_models_model ON appliance_models(model);

        RAISE NOTICE 'Table appliance_models créée avec succès';
    ELSE
        RAISE NOTICE 'Table appliance_models existe déjà, migration ignorée';
    END IF;
END $$;


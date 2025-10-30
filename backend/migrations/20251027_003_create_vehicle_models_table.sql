-- Migration: Création table vehicle_models pour liens Marque-Modèle automobiles
-- Date: 2025-10-27
-- Description: Table pour stocker les modèles de véhicules par marque avec système intelligent
-- Note: Compatible avec SQLx offline mode

-- Créer la table vehicle_models
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_models') THEN
        CREATE TABLE vehicle_models (
            id SERIAL PRIMARY KEY,
            brand VARCHAR(100) NOT NULL,
            model VARCHAR(200) NOT NULL,
            year_min INTEGER,
            year_max INTEGER,
            category VARCHAR(50),              -- Voiture, Moto, Camion, SUV
            fuel_type VARCHAR(50),             -- Essence, Diesel, Hybride, Électrique
            usage_count INTEGER NOT NULL DEFAULT 0,
            added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(brand, model)
        );

        -- Index pour optimiser les recherches
        CREATE INDEX idx_vehicle_models_brand ON vehicle_models(brand);
        CREATE INDEX idx_vehicle_models_model ON vehicle_models(model);
        CREATE INDEX idx_vehicle_models_brand_model ON vehicle_models(brand, model);
        CREATE INDEX idx_vehicle_models_usage ON vehicle_models(usage_count DESC);
        CREATE INDEX idx_vehicle_models_category ON vehicle_models(category);

        -- Commentaires
        COMMENT ON TABLE vehicle_models IS 'Modèles de véhicules par marque pour autocomplete intelligent';
        COMMENT ON COLUMN vehicle_models.brand IS 'Marque du véhicule (Toyota, Peugeot, Mercedes...)';
        COMMENT ON COLUMN vehicle_models.model IS 'Modèle du véhicule (Corolla, 308, Classe C...)';
        COMMENT ON COLUMN vehicle_models.usage_count IS 'Compteur d''utilisations pour trier par popularité';

        -- Insérer les données par défaut (marques et modèles populaires au Cameroun)
        INSERT INTO vehicle_models (brand, model, category, fuel_type, usage_count) VALUES
        -- TOYOTA (très populaire au Cameroun)
        ('Toyota', 'Corolla', 'Voiture', 'Essence', 50),
        ('Toyota', 'Camry', 'Voiture', 'Essence', 45),
        ('Toyota', 'RAV4', 'SUV', 'Essence', 42),
        ('Toyota', 'Land Cruiser', 'SUV', 'Diesel', 48),
        ('Toyota', 'Prado', 'SUV', 'Diesel', 40),
        ('Toyota', 'Hilux', 'Pick-up', 'Diesel', 55),
        ('Toyota', 'Yaris', 'Voiture', 'Essence', 35),
        ('Toyota', 'Avensis', 'Voiture', 'Diesel', 30),
        ('Toyota', 'Highlander', 'SUV', 'Essence', 32),
        ('Toyota', 'Fortuner', 'SUV', 'Diesel', 38),
        
        -- PEUGEOT (très populaire)
        ('Peugeot', '206', 'Voiture', 'Essence', 28),
        ('Peugeot', '207', 'Voiture', 'Essence', 30),
        ('Peugeot', '208', 'Voiture', 'Essence', 32),
        ('Peugeot', '307', 'Voiture', 'Diesel', 26),
        ('Peugeot', '308', 'Voiture', 'Diesel', 28),
        ('Peugeot', '508', 'Voiture', 'Diesel', 25),
        ('Peugeot', 'Partner', 'Utilitaire', 'Diesel', 22),
        ('Peugeot', '3008', 'SUV', 'Diesel', 30),
        ('Peugeot', '5008', 'SUV', 'Diesel', 28),
        ('Peugeot', 'Boxer', 'Utilitaire', 'Diesel', 20),
        
        -- MERCEDES-BENZ
        ('Mercedes-Benz', 'Classe C', 'Voiture', 'Diesel', 35),
        ('Mercedes-Benz', 'Classe E', 'Voiture', 'Diesel', 32),
        ('Mercedes-Benz', 'Classe A', 'Voiture', 'Essence', 25),
        ('Mercedes-Benz', 'GLA', 'SUV', 'Diesel', 28),
        ('Mercedes-Benz', 'GLE', 'SUV', 'Diesel', 30),
        ('Mercedes-Benz', 'ML', 'SUV', 'Diesel', 32),
        ('Mercedes-Benz', 'Vito', 'Utilitaire', 'Diesel', 24),
        ('Mercedes-Benz', 'Sprinter', 'Utilitaire', 'Diesel', 22),
        
        -- NISSAN
        ('Nissan', 'Patrol', 'SUV', 'Diesel', 40),
        ('Nissan', 'Navara', 'Pick-up', 'Diesel', 35),
        ('Nissan', 'X-Trail', 'SUV', 'Essence', 28),
        ('Nissan', 'Qashqai', 'SUV', 'Essence', 26),
        ('Nissan', 'Micra', 'Voiture', 'Essence', 20),
        ('Nissan', 'Juke', 'SUV', 'Essence', 22),
        
        -- HONDA
        ('Honda', 'Civic', 'Voiture', 'Essence', 30),
        ('Honda', 'Accord', 'Voiture', 'Essence', 28),
        ('Honda', 'CR-V', 'SUV', 'Essence', 32),
        ('Honda', 'Pilot', 'SUV', 'Essence', 26),
        ('Honda', 'City', 'Voiture', 'Essence', 24),
        
        -- HYUNDAI
        ('Hyundai', 'i10', 'Voiture', 'Essence', 22),
        ('Hyundai', 'i20', 'Voiture', 'Essence', 24),
        ('Hyundai', 'Tucson', 'SUV', 'Diesel', 28),
        ('Hyundai', 'Santa Fe', 'SUV', 'Diesel', 26),
        ('Hyundai', 'Elantra', 'Voiture', 'Essence', 20),
        
        -- KIA
        ('Kia', 'Rio', 'Voiture', 'Essence', 20),
        ('Kia', 'Sportage', 'SUV', 'Diesel', 26),
        ('Kia', 'Sorento', 'SUV', 'Diesel', 24),
        ('Kia', 'Picanto', 'Voiture', 'Essence', 18),
        
        -- BMW
        ('BMW', 'Série 3', 'Voiture', 'Diesel', 28),
        ('BMW', 'Série 5', 'Voiture', 'Diesel', 26),
        ('BMW', 'X3', 'SUV', 'Diesel', 25),
        ('BMW', 'X5', 'SUV', 'Diesel', 28),
        ('BMW', 'X6', 'SUV', 'Diesel', 24),
        
        -- VOLKSWAGEN
        ('Volkswagen', 'Golf', 'Voiture', 'Diesel', 24),
        ('Volkswagen', 'Passat', 'Voiture', 'Diesel', 22),
        ('Volkswagen', 'Tiguan', 'SUV', 'Diesel', 26),
        ('Volkswagen', 'Polo', 'Voiture', 'Essence', 20),
        ('Volkswagen', 'Touareg', 'SUV', 'Diesel', 25),
        
        -- RENAULT
        ('Renault', 'Clio', 'Voiture', 'Essence', 22),
        ('Renault', 'Mégane', 'Voiture', 'Diesel', 20),
        ('Renault', 'Duster', 'SUV', 'Diesel', 24),
        ('Renault', 'Kangoo', 'Utilitaire', 'Diesel', 18),
        
        -- FORD
        ('Ford', 'Focus', 'Voiture', 'Diesel', 20),
        ('Ford', 'Ranger', 'Pick-up', 'Diesel', 28),
        ('Ford', 'Explorer', 'SUV', 'Essence', 22),
        ('Ford', 'Transit', 'Utilitaire', 'Diesel', 24),
        
        -- MITSUBISHI
        ('Mitsubishi', 'L200', 'Pick-up', 'Diesel', 32),
        ('Mitsubishi', 'Pajero', 'SUV', 'Diesel', 30),
        ('Mitsubishi', 'Outlander', 'SUV', 'Essence', 22),
        ('Mitsubishi', 'ASX', 'SUV', 'Essence', 20),
        
        -- ISUZU
        ('Isuzu', 'D-Max', 'Pick-up', 'Diesel', 26),
        ('Isuzu', 'MU-X', 'SUV', 'Diesel', 24),
        
        -- MAZDA
        ('Mazda', '3', 'Voiture', 'Essence', 18),
        ('Mazda', 'CX-5', 'SUV', 'Diesel', 22),
        ('Mazda', 'CX-3', 'SUV', 'Essence', 18),
        
        -- AUDI
        ('Audi', 'A3', 'Voiture', 'Diesel', 20),
        ('Audi', 'A4', 'Voiture', 'Diesel', 22),
        ('Audi', 'Q5', 'SUV', 'Diesel', 24),
        ('Audi', 'Q7', 'SUV', 'Diesel', 22)
        
        ON CONFLICT (brand, model) DO NOTHING;

        RAISE NOTICE 'Table vehicle_models créée avec succès avec modèles par défaut';
    ELSE
        RAISE NOTICE 'Table vehicle_models existe déjà, migration ignorée';
    END IF;
END $$;









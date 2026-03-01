-- Migration: Ajouter les colonnes manquantes à product_delivery_config
-- Date: 2026-03-01
-- Contexte: Les colonnes preparation_time_minutes, max_preparation_time_minutes,
-- availability_days, is_immediately_available sont requises par check_availability()
-- mais n'étaient pas dans 0000_create_all_tables.sql.
-- Si la migration 20250120_001 n'a pas été appliquée, ces colonnes sont absentes
-- et causent une erreur 500 sur /api/delivery/client-order et /api/delivery/estimate-costs.

ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER,
ADD COLUMN IF NOT EXISTS max_preparation_time_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS availability_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
ADD COLUMN IF NOT EXISTS is_immediately_available BOOLEAN DEFAULT FALSE;

-- Index pour recherche par jours de disponibilité
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_availability_days 
ON product_delivery_config USING GIN(availability_days);

-- Créer les tables delivery_engine_pricing et delivery_insurance_fees si absentes
-- (requises par estimate_delivery_costs et create_client_order)

-- Type ENUM pour les types d'engin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_engine_type') THEN
        CREATE TYPE delivery_engine_type AS ENUM (
            'moto', 'scooter', 'voiture', 'camionnette',
            'velo_cargo', 'pieton', 'camion_leger', 'autre'
        );
    END IF;
END $$;

-- Table delivery_engine_pricing
CREATE TABLE IF NOT EXISTS delivery_engine_pricing (
    engine_type delivery_engine_type PRIMARY KEY,
    cost_per_km_fcfa NUMERIC(10, 2) NOT NULL,
    minimum_cost_fcfa NUMERIC(10, 2) NOT NULL,
    fuel_consumption_l_per_km NUMERIC(6, 3),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default pricing values
INSERT INTO delivery_engine_pricing (engine_type, cost_per_km_fcfa, minimum_cost_fcfa, fuel_consumption_l_per_km, description)
VALUES
    ('pieton', 200.00, 500.00, NULL, 'Livraison à pied'),
    ('velo_cargo', 200.00, 800.00, NULL, 'Vélo cargo'),
    ('scooter', 225.00, 1000.00, 0.030, 'Scooter'),
    ('moto', 225.00, 1000.00, 0.040, 'Moto'),
    ('voiture', 600.00, 1500.00, 0.080, 'Voiture'),
    ('camionnette', 1000.00, 5000.00, 0.100, 'Camionnette/Pickup'),
    ('camion_leger', 2000.00, 10000.00, 0.120, 'Camion léger'),
    ('autre', 500.00, 1000.00, NULL, 'Autre type - Prix par défaut')
ON CONFLICT (engine_type) DO NOTHING;

-- Table delivery_insurance_fees
CREATE TABLE IF NOT EXISTS delivery_insurance_fees (
    engine_type delivery_engine_type PRIMARY KEY,
    base_fee_fcfa NUMERIC(10, 2) NOT NULL DEFAULT 0,
    percentage_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    max_fee_fcfa NUMERIC(10, 2) NOT NULL DEFAULT 0,
    min_value_threshold NUMERIC(10, 2) NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default insurance values
INSERT INTO delivery_insurance_fees (engine_type, base_fee_fcfa, percentage_rate, max_fee_fcfa, min_value_threshold, description)
VALUES
    ('pieton', 0, 0, 0, 999999, 'Livraison à pied - pas d''assurance'),
    ('velo_cargo', 100, 0.5, 1000, 5000, 'Vélo cargo'),
    ('scooter', 200, 0.8, 2500, 3000, 'Scooter'),
    ('moto', 250, 1.0, 3000, 2000, 'Moto'),
    ('voiture', 300, 1.2, 5000, 1000, 'Voiture'),
    ('camionnette', 500, 1.5, 10000, 500, 'Camionnette'),
    ('camion_leger', 1000, 2.0, 20000, 0, 'Camion léger'),
    ('autre', 250, 1.0, 3000, 2000, 'Autre type')
ON CONFLICT (engine_type) DO NOTHING;

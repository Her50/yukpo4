-- ✅ Migration : Table de configuration des prix par type d'engin
-- Permet de paramétrer le coût de livraison selon le type d'engin utilisé

-- ✅ CORRIGÉ 2026-01-29: Vérifier et créer le type ENUM si nécessaire
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_engine_type') THEN
        CREATE TYPE delivery_engine_type AS ENUM (
            'moto',
            'scooter',
            'voiture',
            'camionnette',
            'velo_cargo',
            'pieton',
            'camion_leger',
            'autre'
        );
    END IF;
END $$;

-- Ajouter tricycle à l'enum si pas déjà présent
-- ✅ CORRIGÉ: ALTER TYPE ADD VALUE ne peut pas être dans une transaction
-- On utilise une exception pour ignorer l'erreur "unsafe use of new value"
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'tricycle' 
        AND enumtypid = 'delivery_engine_type'::regtype
    ) THEN
        BEGIN
            ALTER TYPE delivery_engine_type ADD VALUE 'tricycle';
        EXCEPTION
            WHEN OTHERS THEN
                -- Ignorer l'erreur "unsafe use of new value" si l'enum est utilisé dans une table
                -- L'enum sera créé avec tricycle par ensure_delivery_tables dans auto_migrate.rs
                NULL;
        END;
    END IF;
END $$;

-- Créer la table
CREATE TABLE IF NOT EXISTS delivery_engine_pricing (
    engine_type delivery_engine_type PRIMARY KEY,
    cost_per_km_fcfa NUMERIC(10, 2) NOT NULL,
    minimum_cost_fcfa NUMERIC(10, 2) NOT NULL,
    fuel_consumption_l_per_km NUMERIC(6, 3),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_delivery_engine_pricing_type ON delivery_engine_pricing(engine_type);

-- Valeurs par défaut réalistes (prix ajustés selon demande)
INSERT INTO delivery_engine_pricing (engine_type, cost_per_km_fcfa, minimum_cost_fcfa, fuel_consumption_l_per_km, description)
VALUES
    ('pieton', 200.00, 500.00, NULL, 'Livraison à pied - Pas de carburant'),
    ('velo_cargo', 200.00, 800.00, NULL, 'Vélo cargo - Pas de carburant (réduit)'),
    ('scooter', 225.00, 1000.00, 0.030, 'Scooter - Consommation ~3L/100km (réduit de moitié, aligné avec moto)'),
    ('moto', 225.00, 1000.00, 0.040, 'Moto - Consommation ~4L/100km (réduit de moitié, aligné avec scooter)'),
    ('tricycle', 250.00, 1000.00, 0.035, 'Tricycle - Consommation ~3.5L/100km'),
    ('voiture', 600.00, 1500.00, 0.080, 'Voiture - Consommation ~8L/100km'),
    ('camionnette', 1000.00, 5000.00, 0.100, 'Camionnette/Pickup - Consommation ~10L/100km (base 1000, min 5000)'),
    ('camion_leger', 2000.00, 10000.00, 0.120, 'Camion léger - Consommation ~12L/100km (base 2000, min 10000)'),
    ('autre', 500.00, 1000.00, NULL, 'Autre type d''engin - Prix par défaut')
ON CONFLICT (engine_type) 
DO UPDATE SET 
    cost_per_km_fcfa = EXCLUDED.cost_per_km_fcfa,
    minimum_cost_fcfa = EXCLUDED.minimum_cost_fcfa,
    fuel_consumption_l_per_km = EXCLUDED.fuel_consumption_l_per_km,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_delivery_engine_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_delivery_engine_pricing_updated_at ON delivery_engine_pricing;
CREATE TRIGGER trigger_update_delivery_engine_pricing_updated_at
    BEFORE UPDATE ON delivery_engine_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_delivery_engine_pricing_updated_at();

COMMENT ON TABLE delivery_engine_pricing IS 'Configuration des prix de livraison par type d''engin. Permet de paramétrer le coût par km et le minimum garanti pour chaque type de véhicule.';
COMMENT ON COLUMN delivery_engine_pricing.cost_per_km_fcfa IS 'Coût par kilomètre en FCFA';
COMMENT ON COLUMN delivery_engine_pricing.minimum_cost_fcfa IS 'Coût minimum garanti en FCFA (même pour distances très courtes)';
COMMENT ON COLUMN delivery_engine_pricing.fuel_consumption_l_per_km IS 'Consommation carburant en litres par km (optionnel, pour information)';


-- ✅ Migration : Table de configuration des prix par type d'engin
-- Permet de paramétrer le coût de livraison selon le type d'engin utilisé

CREATE TABLE IF NOT EXISTS delivery_engine_pricing (
    engine_type delivery_engine_type PRIMARY KEY,
    cost_per_km_fcfa NUMERIC(10, 2) NOT NULL,
    minimum_cost_fcfa NUMERIC(10, 2) NOT NULL,
    fuel_consumption_l_per_km NUMERIC(6, 3), -- Consommation en litres par km (optionnel, pour info)
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_delivery_engine_pricing_type ON delivery_engine_pricing(engine_type);

-- Valeurs par défaut réalistes (basées sur coûts carburant et maintenance au Cameroun)
INSERT INTO delivery_engine_pricing (engine_type, cost_per_km_fcfa, minimum_cost_fcfa, fuel_consumption_l_per_km, description)
VALUES
    ('pieton', 200.00, 500.00, NULL, 'Livraison à pied - Pas de carburant'),
    ('velo_cargo', 300.00, 800.00, NULL, 'Vélo cargo - Pas de carburant'),
    ('scooter', 400.00, 1000.00, 0.030, 'Scooter - Consommation ~3L/100km'),
    ('moto', 450.00, 1000.00, 0.040, 'Moto - Consommation ~4L/100km'),
    ('voiture', 600.00, 1500.00, 0.080, 'Voiture - Consommation ~8L/100km'),
    ('camionnette', 700.00, 2000.00, 0.100, 'Camionnette - Consommation ~10L/100km'),
    ('camion_leger', 900.00, 3000.00, 0.120, 'Camion léger - Consommation ~12L/100km'),
    ('autre', 500.00, 1000.00, NULL, 'Autre type d''engin - Prix par défaut')
ON CONFLICT (engine_type) DO NOTHING;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_delivery_engine_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_delivery_engine_pricing_updated_at
    BEFORE UPDATE ON delivery_engine_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_delivery_engine_pricing_updated_at();

COMMENT ON TABLE delivery_engine_pricing IS 'Configuration des prix de livraison par type d''engin. Permet de paramétrer le coût par km et le minimum garanti pour chaque type de véhicule.';
COMMENT ON COLUMN delivery_engine_pricing.cost_per_km_fcfa IS 'Coût par kilomètre en FCFA';
COMMENT ON COLUMN delivery_engine_pricing.minimum_cost_fcfa IS 'Coût minimum garanti en FCFA (même pour distances très courtes)';
COMMENT ON COLUMN delivery_engine_pricing.fuel_consumption_l_per_km IS 'Consommation carburant en litres par km (optionnel, pour information)';


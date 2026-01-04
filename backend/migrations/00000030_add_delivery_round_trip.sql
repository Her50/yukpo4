-- Migration: Ajout du système de livraison aller-retour
-- Date: 2025-01-31

-- Ajouter les colonnes pour les livraisons aller-retour
ALTER TABLE deliveries 
ADD COLUMN IF NOT EXISTS is_round_trip BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS return_delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS return_pickup_location GEOGRAPHY(Point, 4326),
ADD COLUMN IF NOT EXISTS return_dropoff_location GEOGRAPHY(Point, 4326),
ADD COLUMN IF NOT EXISTS return_pickup_address TEXT,
ADD COLUMN IF NOT EXISTS return_dropoff_address TEXT,
ADD COLUMN IF NOT EXISTS return_distance_meters INTEGER,
ADD COLUMN IF NOT EXISTS return_estimated_duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS return_actual_duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS round_trip_discount_percent INTEGER DEFAULT 0; -- Réduction en % pour aller-retour

-- Index pour les requêtes de retour
CREATE INDEX IF NOT EXISTS idx_deliveries_return_delivery_id ON deliveries(return_delivery_id) WHERE return_delivery_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_is_round_trip ON deliveries(is_round_trip) WHERE is_round_trip = TRUE;
CREATE INDEX IF NOT EXISTS idx_deliveries_return_pickup_location ON deliveries USING GIST(return_pickup_location) WHERE return_pickup_location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_return_dropoff_location ON deliveries USING GIST(return_dropoff_location) WHERE return_dropoff_location IS NOT NULL;

-- Commentaires
COMMENT ON COLUMN deliveries.is_round_trip IS 'Indique si cette livraison fait partie d''un aller-retour';
COMMENT ON COLUMN deliveries.return_delivery_id IS 'ID de la livraison retour (si cette livraison est l''aller)';
COMMENT ON COLUMN deliveries.return_pickup_location IS 'Point de collecte pour le retour (même que dropoff de l''aller)';
COMMENT ON COLUMN deliveries.return_dropoff_location IS 'Point de livraison pour le retour (même que pickup de l''aller)';
COMMENT ON COLUMN deliveries.round_trip_discount_percent IS 'Réduction appliquée pour l''aller-retour (0-100%)';

-- Contrainte : si is_round_trip = TRUE et que c'est la livraison aller, return_delivery_id doit être défini après création de la livraison retour
-- Contrainte : les deux livraisons (aller et retour) doivent avoir le même créateur
CREATE OR REPLACE FUNCTION check_round_trip_consistency()
RETURNS TRIGGER AS $$
BEGIN
    -- Vérifier que si return_delivery_id est défini, la livraison retour existe et appartient au même créateur
    IF NEW.return_delivery_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM deliveries 
            WHERE id = NEW.return_delivery_id 
            AND creator_id = NEW.creator_id
        ) THEN
            RAISE EXCEPTION 'La livraison retour doit appartenir au même créateur';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_round_trip_consistency ON deliveries;
CREATE TRIGGER trigger_check_round_trip_consistency
    BEFORE INSERT OR UPDATE ON deliveries
    FOR EACH ROW
    EXECUTE FUNCTION check_round_trip_consistency();


-- Migration: Creer les tables delivery_requests et courier_profiles manquantes
-- Date: 2026-02-07
-- Description: Ces tables sont utilisees par le code backend mais n'existent pas dans la base

-- =====================================================
-- 1. TABLE delivery_requests
-- =====================================================
-- Base sur l'utilisation dans le code: id, client_id, courier_id, service_id, metadata
-- Cette table semble etre un alias/vue pour deliveries avec des colonnes renommees

CREATE OR REPLACE VIEW delivery_requests AS
SELECT 
    d.id,
    d.creator_id as client_id,
    d.courier_id,
    NULL::INTEGER as service_id, -- service_id n'existe pas dans deliveries, peut etre dans metadata
    d.metadata,
    d.status,
    d.requested_at,
    d.pickup_location,
    d.dropoff_location,
    d.pickup_address,
    d.dropoff_address,
    d.recipient_user_id,
    d.recipient_contact_name,
    d.recipient_contact_phone,
    d.created_at,
    d.updated_at
FROM deliveries d;

COMMENT ON VIEW delivery_requests IS 'Vue sur les deliveries pour compatibilite avec le code backend - mappe creator_id vers client_id';

-- =====================================================
-- 2. TABLE courier_profiles
-- =====================================================
-- Cette table semble contenir les positions GPS en temps reel des coursiers
-- Base sur l'utilisation: id, current_latitude, current_longitude

CREATE TABLE IF NOT EXISTS courier_profiles (
    id UUID PRIMARY KEY REFERENCES couriers(id) ON DELETE CASCADE,
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    last_location_update TIMESTAMPTZ DEFAULT now(),
    is_online BOOLEAN DEFAULT FALSE,
    current_status TEXT, -- 'available', 'on_delivery', 'busy', etc.
    current_delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour recherche geographique
CREATE INDEX IF NOT EXISTS idx_courier_profiles_location ON courier_profiles(current_latitude, current_longitude) 
WHERE current_latitude IS NOT NULL AND current_longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_courier_profiles_online ON courier_profiles(is_online) WHERE is_online = TRUE;
CREATE INDEX IF NOT EXISTS idx_courier_profiles_status ON courier_profiles(current_status);

-- Trigger pour mettre a jour updated_at
CREATE OR REPLACE FUNCTION update_courier_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_courier_profiles_updated_at ON courier_profiles;
CREATE TRIGGER trigger_update_courier_profiles_updated_at
    BEFORE UPDATE ON courier_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_courier_profiles_updated_at();

COMMENT ON TABLE courier_profiles IS 'Profils coursiers avec positions GPS en temps reel';


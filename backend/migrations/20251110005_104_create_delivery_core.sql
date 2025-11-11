-- Migration: Création des tables coeur de livraison
-- Date: 2025-11-10
CREATE TABLE IF NOT EXISTS delivery_parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_id INTEGER REFERENCES parcel_types(id) ON DELETE SET NULL,
    weight_kg NUMERIC(6,2),
    volume_cm3 NUMERIC(12,2),
    declared_value NUMERIC(10,2),
    notes TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    constraints JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL,
    parcel_id UUID NOT NULL REFERENCES delivery_parcels(id) ON DELETE CASCADE,
    status delivery_status NOT NULL DEFAULT 'requested',
    requested_at TIMESTAMPTZ DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_reason delivery_cancel_reason,
    pickup_location GEOGRAPHY(Point, 4326) NOT NULL,
    dropoff_location GEOGRAPHY(Point, 4326) NOT NULL,
    pickup_address TEXT,
    dropoff_address TEXT,
    distance_meters INTEGER,
    estimated_duration_seconds INTEGER,
    actual_duration_seconds INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now(),
    pricing_id UUID,
    tracking_token UUID UNIQUE DEFAULT gen_random_uuid(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_deliveries_status_requested_at ON deliveries (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries (courier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_creator ON deliveries (creator_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_location ON deliveries USING GIST (pickup_location);
CREATE INDEX IF NOT EXISTS idx_deliveries_dropoff_location ON deliveries USING GIST (dropoff_location);

CREATE TABLE IF NOT EXISTS delivery_status_events (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    status delivery_status NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload JSONB DEFAULT '{}'::jsonb,
    recorded_by INTEGER
);

CREATE INDEX IF NOT EXISTS idx_delivery_status_events_delivery ON delivery_status_events (delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status_events_delivery_time ON delivery_status_events (delivery_id, occurred_at DESC);


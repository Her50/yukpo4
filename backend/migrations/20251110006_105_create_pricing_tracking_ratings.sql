-- Migration: Création des tables pricing, tracking et ratings
-- Date: 2025-11-10
CREATE TABLE IF NOT EXISTS delivery_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    base_price_cents INTEGER NOT NULL,
    distance_price_cents INTEGER NOT NULL,
    surcharge_cents INTEGER DEFAULT 0,
    discount_cents INTEGER DEFAULT 0,
    currency CHAR(3) DEFAULT 'XAF',
    calculated_at TIMESTAMPTZ DEFAULT now(),
    details JSONB DEFAULT '{}'::jsonb
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_deliveries_pricing'
          AND table_name = 'deliveries'
    ) THEN
        ALTER TABLE deliveries
            ADD CONSTRAINT fk_deliveries_pricing
            FOREIGN KEY (pricing_id)
            REFERENCES delivery_pricing(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS delivery_tracking_points (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    location GEOGRAPHY(Point, 4326) NOT NULL,
    speed_kmh NUMERIC(5,2),
    bearing NUMERIC(6,2),
    accuracy_meters NUMERIC(6,2)
);

CREATE INDEX IF NOT EXISTS idx_tracking_points_delivery ON delivery_tracking_points (delivery_id);
CREATE INDEX IF NOT EXISTS idx_tracking_points_courier ON delivery_tracking_points (courier_id);
CREATE INDEX IF NOT EXISTS idx_tracking_points_captured_at ON delivery_tracking_points (captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_points_location ON delivery_tracking_points USING GIST (location);

CREATE TABLE IF NOT EXISTS courier_ratings (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    rater_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score_small INTEGER NOT NULL CHECK (score_small BETWEEN 1 AND 5),
    tags TEXT[],
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_ratings_courier ON courier_ratings (courier_id);

CREATE TABLE IF NOT EXISTS client_ratings (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    score_small INTEGER NOT NULL CHECK (score_small BETWEEN 1 AND 5),
    tags TEXT[],
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_ratings_client ON client_ratings (client_id);


-- Tables pour le système de livraison

-- Types ENUM pour la livraison
DO $$
BEGIN
    CREATE TYPE delivery_status AS ENUM (
        'requested',
        'confirmed',
        'accepted',
        'picked_up',
        'in_transit',
        'delivered',
        'completed',
        'cancelled',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_cancel_reason AS ENUM (
        'client_request',
        'courier_unavailable',
        'weather',
        'address_issue',
        'payment_failed',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_courier_status AS ENUM (
        'pending_review',
        'active',
        'suspended',
        'inactive',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_engine_type AS ENUM (
        'bike',
        'motorcycle',
        'tricycle',
        'car',
        'pickup',
        'van',
        'truck',
        'walking'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_terrain_difficulty AS ENUM (
        'smooth',
        'moderate',
        'rough',
        'blocked'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_application_status AS ENUM (
        'draft',
        'submitted',
        'under_review',
        'approved',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE shopping_status AS ENUM (
        'pending',
        'awaiting_purchase',
        'shopping_in_progress',
        'shopping_completed',
        'checkout_submitted',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE shopping_item_status AS ENUM (
        'pending',
        'purchased',
        'missing',
        'replaced'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- Parcel types catalogue
CREATE TABLE IF NOT EXISTS parcel_types (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    max_weight_kg NUMERIC(6,2),
    max_volume_cm3 NUMERIC(12,2),
    requires_isothermal BOOLEAN DEFAULT FALSE,
    requires_fragile_handling BOOLEAN DEFAULT FALSE,
    requires_secure_box BOOLEAN DEFAULT FALSE,
    requires_document_protection BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parcel_types_slug ON parcel_types(slug);

-- Courier onboarding
CREATE TABLE IF NOT EXISTS courier_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status delivery_application_status NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewer_id INTEGER REFERENCES users(id),
    rejection_reason TEXT,
    profile_data JSONB DEFAULT '{}'::jsonb,
    documents JSONB DEFAULT '[]'::jsonb,
    notes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_applications_user ON courier_applications(user_id);

CREATE TABLE IF NOT EXISTS couriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id UUID UNIQUE REFERENCES courier_applications(id) ON DELETE SET NULL,
    status delivery_courier_status NOT NULL DEFAULT 'pending_review',
    rating_average NUMERIC(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    bio TEXT,
    hired_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courier_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    engine_type delivery_engine_type NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    max_weight_kg NUMERIC(6,2),
    max_volume_cm3 NUMERIC(12,2),
    equipments JSONB DEFAULT '[]'::jsonb,
    available BOOLEAN DEFAULT TRUE,
    availability_schedule JSONB,
    documents JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_assets_courier ON courier_assets(courier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_assets_primary ON courier_assets(courier_id) WHERE is_primary = TRUE;

-- Delivery core tables
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
    recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    recipient_contact_name TEXT,
    recipient_contact_phone TEXT,
    recipient_notes TEXT,
    recipient_tracking_token UUID UNIQUE DEFAULT gen_random_uuid(),
    recipient_dropoff_override GEOGRAPHY(Point, 4326),
    recipient_dropoff_address TEXT,
    recipient_dropoff_updated_at TIMESTAMPTZ,
    recipient_chat_thread_id UUID,
    distance_meters INTEGER,
    estimated_duration_seconds INTEGER,
    actual_duration_seconds INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now(),
    pricing_id UUID,
    tracking_token UUID UNIQUE DEFAULT gen_random_uuid(),
    metadata JSONB DEFAULT '{}'::jsonb,
    shopping_required BOOLEAN DEFAULT FALSE,
    store_location GEOGRAPHY(Point, 4326),
    store_name TEXT,
    is_round_trip BOOLEAN DEFAULT FALSE,
    return_pickup_location GEOGRAPHY(Point, 4326),
    return_dropoff_location GEOGRAPHY(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_deliveries_status_requested_at ON deliveries(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries(courier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_creator ON deliveries(creator_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_user ON deliveries(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_tracking_token ON deliveries(recipient_tracking_token);
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_location ON deliveries USING GIST(pickup_location);
CREATE INDEX IF NOT EXISTS idx_deliveries_dropoff_location ON deliveries USING GIST(dropoff_location);

CREATE TABLE IF NOT EXISTS delivery_status_events (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    status delivery_status NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload JSONB DEFAULT '{}'::jsonb,
    recorded_by INTEGER
);

CREATE INDEX IF NOT EXISTS idx_delivery_status_events_delivery ON delivery_status_events(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status_events_delivery_time ON delivery_status_events(delivery_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS delivery_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    base_price_cents INTEGER NOT NULL,
    distance_price_cents INTEGER NOT NULL,
    surcharge_cents INTEGER DEFAULT 0,
    discount_cents INTEGER DEFAULT 0,
    currency CHAR(3) DEFAULT 'XAF',
    calculated_at TIMESTAMPTZ DEFAULT now(),
    details JSONB DEFAULT '{}'::jsonb,
    shopping_cost_cents INTEGER DEFAULT 0,
    shopping_discount_cents INTEGER DEFAULT 0
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_deliveries_pricing'
          AND table_name = 'deliveries'
          AND constraint_type = 'FOREIGN KEY'
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

CREATE INDEX IF NOT EXISTS idx_tracking_points_delivery ON delivery_tracking_points(delivery_id);
CREATE INDEX IF NOT EXISTS idx_tracking_points_courier ON delivery_tracking_points(courier_id);
CREATE INDEX IF NOT EXISTS idx_tracking_points_captured_at ON delivery_tracking_points(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_points_location ON delivery_tracking_points USING GIST(location);

CREATE TABLE IF NOT EXISTS delivery_recipient_updates (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    submitted_by INTEGER REFERENCES users(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_recipient_updates_delivery ON delivery_recipient_updates(delivery_id, created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_courier_ratings_courier ON courier_ratings(courier_id);

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

CREATE INDEX IF NOT EXISTS idx_client_ratings_client ON client_ratings(client_id);

CREATE TABLE IF NOT EXISTS shopping_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    status shopping_status NOT NULL DEFAULT 'pending',
    estimated_total_cents INTEGER NOT NULL DEFAULT 0,
    actual_total_cents INTEGER,
    currency CHAR(3) DEFAULT 'XAF',
    store_name TEXT,
    store_location GEOGRAPHY(Point, 4326),
    notes TEXT,
    requires_balance_top_up BOOLEAN DEFAULT FALSE,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_orders_status ON shopping_orders(status);

CREATE TABLE IF NOT EXISTS shopping_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopping_order_id UUID NOT NULL REFERENCES shopping_orders(id) ON DELETE CASCADE,
    product_id UUID,
    product_name TEXT NOT NULL,
    characteristics JSONB DEFAULT '[]'::jsonb,
    quantity NUMERIC(10,2) NOT NULL,
    unit TEXT DEFAULT 'unite',
    estimated_price_cents INTEGER DEFAULT 0,
    actual_price_cents INTEGER,
    status shopping_item_status NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_order_items_order ON shopping_order_items(shopping_order_id);
CREATE INDEX IF NOT EXISTS idx_shopping_order_items_status ON shopping_order_items(status);

CREATE TABLE IF NOT EXISTS delivery_wallet_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('debit', 'refund')),
    amount_cents BIGINT NOT NULL,
    reason TEXT,
    balance_after BIGINT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_wallet_events_user ON delivery_wallet_events(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_wallet_events_delivery ON delivery_wallet_events(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_wallet_events_created_at ON delivery_wallet_events(created_at DESC);

-- Infrastructure de matching temps réel
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'delivery_matching_status'
    ) THEN
        CREATE TYPE delivery_matching_status AS ENUM (
            'queued',
            'searching',
            'assigned',
            'rejected',
            'failed',
            'timeout',
            'cancelled',
            'fallback',
            'no_courier'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    region GEOGRAPHY(MultiPolygon, 4326),
    center GEOGRAPHY(Point, 4326),
    max_active_couriers INTEGER NOT NULL DEFAULT 500,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_region ON delivery_zones USING GIST (region);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_center ON delivery_zones USING GIST (center);

CREATE TABLE IF NOT EXISTS courier_zone_assignments (
    id BIGSERIAL PRIMARY KEY,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    zone_id UUID NOT NULL REFERENCES delivery_zones(id) ON DELETE CASCADE,
    capacity_weight SMALLINT NOT NULL DEFAULT 1,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (courier_id, zone_id)
);

CREATE INDEX IF NOT EXISTS idx_courier_zone_assignments_zone ON courier_zone_assignments(zone_id);
CREATE INDEX IF NOT EXISTS idx_courier_zone_assignments_active ON courier_zone_assignments(is_active);

CREATE TABLE IF NOT EXISTS courier_availability_snapshots (
    id BIGSERIAL PRIMARY KEY,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES delivery_zones(id),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    active_deliveries SMALLINT NOT NULL DEFAULT 0,
    max_capacity SMALLINT NOT NULL DEFAULT 2,
    load_factor NUMERIC(6,3) NOT NULL DEFAULT 0,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location GEOGRAPHY(Point, 4326),
    battery_level SMALLINT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_courier ON courier_availability_snapshots(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_zone ON courier_availability_snapshots(zone_id);
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_capture ON courier_availability_snapshots(courier_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_location ON courier_availability_snapshots USING GIST (location);

CREATE TABLE IF NOT EXISTS delivery_matching_queue (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES delivery_zones(id),
    status delivery_matching_status NOT NULL DEFAULT 'queued',
    priority SMALLINT NOT NULL DEFAULT 100,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enqueued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_status ON delivery_matching_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_zone ON delivery_matching_queue(zone_id);
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_optimized
ON delivery_matching_queue (status, next_attempt_at, priority)
WHERE status IN ('queued', 'searching');
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_priority_next_attempt
ON delivery_matching_queue (priority, next_attempt_at)
WHERE status IN ('queued', 'searching');

CREATE TABLE IF NOT EXISTS delivery_matching_events (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    courier_id UUID REFERENCES couriers(id),
    status delivery_matching_status NOT NULL,
    score NUMERIC(8,3),
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_matching_events_delivery ON delivery_matching_events(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_matching_events_courier ON delivery_matching_events(courier_id);

-- Seed default parcel types
INSERT INTO parcel_types (id, slug, display_name, description, max_weight_kg, max_volume_cm3, requires_fragile_handling, requires_isothermal, requires_secure_box, requires_document_protection, metadata)
VALUES
    (1, 'bike', 'Vélo', 'Livraison par vélo - Idéal pour petits colis légers et distances courtes', 5, 10000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "bike", "speed": "slow", "range_km": 10}'::jsonb),
    (2, 'motorcycle', 'Moto', 'Livraison par moto - Rapide pour colis moyens en ville', 15, 30000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "motorcycle", "speed": "fast", "range_km": 50}'::jsonb),
    (3, 'tricycle', 'Tricycle', 'Livraison par tricycle - Équilibre capacité/vitesse pour colis moyens', 30, 60000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "tricycle", "speed": "medium", "range_km": 30}'::jsonb),
    (4, 'car', 'Voiture', 'Livraison par voiture - Polyvalent pour tous types de colis', 50, 150000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "car", "speed": "fast", "range_km": 100}'::jsonb),
    (5, 'pickup', 'Pick-up', 'Livraison par pick-up - Idéal pour colis volumineux et lourds', 80, 250000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "pickup", "speed": "medium", "range_km": 80}'::jsonb),
    (6, 'van', 'Camionnette', 'Livraison par camionnette - Grande capacité pour colis multiples', 100, 400000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "van", "speed": "medium", "range_km": 100}'::jsonb),
    (7, 'truck', 'Camion', 'Livraison par camion - Très grande capacité pour déménagements', 500, 1000000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "truck", "speed": "slow", "range_km": 200}'::jsonb),
    (8, 'walking', 'À pied', 'Livraison à pied - Très petits colis, distances très courtes', 2, 5000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "walking", "speed": "very_slow", "range_km": 2}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    max_weight_kg = EXCLUDED.max_weight_kg,
    max_volume_cm3 = EXCLUDED.max_volume_cm3,
    metadata = EXCLUDED.metadata;

-- Réinitialiser la séquence pour commencer à 9 (après les 8 types fixes)
SELECT setval('parcel_types_id_seq', 8, true);






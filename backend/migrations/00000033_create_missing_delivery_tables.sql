-- Tables de livraison manquantes

-- Table traffic_snapshots (instantanés de trafic)
CREATE TABLE IF NOT EXISTS traffic_snapshots (
    id BIGSERIAL PRIMARY KEY,
    captured_at TIMESTAMPTZ NOT NULL,
    source TEXT,
    bounding_box GEOGRAPHY(Polygon, 4326),
    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_captured_at ON traffic_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_source ON traffic_snapshots(source);
CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_bounding_box ON traffic_snapshots USING GIST(bounding_box) WHERE bounding_box IS NOT NULL;

-- Table terrain_segments (segments de terrain pour difficulté de livraison)
CREATE TABLE IF NOT EXISTS terrain_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment GEOGRAPHY(LineString, 4326) NOT NULL,
    difficulty delivery_terrain_difficulty NOT NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terrain_segments_difficulty ON terrain_segments(difficulty);
CREATE INDEX IF NOT EXISTS idx_terrain_segments_segment ON terrain_segments USING GIST(segment);

-- Table video_weekly_reports (rapports hebdomadaires vidéo)
CREATE TABLE IF NOT EXISTS video_weekly_reports (
    id SERIAL PRIMARY KEY,
    week_start TIMESTAMPTZ NOT NULL,
    week_end TIMESTAMPTZ NOT NULL,
    total_videos BIGINT NOT NULL,
    total_views BIGINT NOT NULL,
    average_quality DOUBLE PRECISION NOT NULL,
    top_services JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_weekly_reports_week ON video_weekly_reports(week_start, week_end);

-- Table service_inventory_overrides (surcharges d'inventaire)
CREATE TABLE IF NOT EXISTS service_inventory_overrides (
    id BIGSERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    stock_level INTEGER NOT NULL,
    source TEXT,
    note TEXT,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_inventory_overrides_unique
    ON service_inventory_overrides(service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_service_inventory_overrides_last_synced
    ON service_inventory_overrides(last_synced_at DESC);

-- Table product_delivery_config (configuration livraison par produit)
CREATE TABLE IF NOT EXISTS product_delivery_config (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    
    -- Pickup (obligatoire)
    pickup_address TEXT NOT NULL,
    pickup_latitude DOUBLE PRECISION NOT NULL,
    pickup_longitude DOUBLE PRECISION NOT NULL,
    
    -- Type véhicule (obligatoire)
    required_vehicle_type_id INTEGER NOT NULL REFERENCES parcel_types(id),
    weight_kg DOUBLE PRECISION,
    volume_cm3 DOUBLE PRECISION,
    requires_isothermal BOOLEAN DEFAULT FALSE,
    requires_fragile_handling BOOLEAN DEFAULT FALSE,
    
    -- Plages horaires de récupération (obligatoire)
    pickup_availability_schedule JSONB NOT NULL,
    
    -- Informations additionnelles
    pickup_instructions TEXT,
    billing_mode VARCHAR(50) DEFAULT 'standard',
    billing_partner_label TEXT,
    
    -- Statut
    is_configured BOOLEAN DEFAULT FALSE,
    configured_at TIMESTAMPTZ,
    configured_by INTEGER REFERENCES users(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(service_id, product_index)
);

CREATE INDEX IF NOT EXISTS idx_product_delivery_config_service ON product_delivery_config(service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_active ON product_delivery_config(is_configured) WHERE is_configured = TRUE;

-- Table client_delivery_preferences (préférences de livraison client)
CREATE TABLE IF NOT EXISTS client_delivery_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
    
    -- Préférences de livraison
    preferred_delivery_date DATE,
    preferred_delivery_time_start TIME,
    preferred_delivery_time_end TIME,
    preferred_delivery_window_hours INTEGER DEFAULT 2,
    
    -- Contraintes
    avoid_days INTEGER[],
    urgency_level VARCHAR(50) DEFAULT 'standard',
    
    -- Flexibilité
    is_flexible BOOLEAN DEFAULT TRUE,
    flexibility_window_days INTEGER DEFAULT 3,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_client_delivery_preferences_user ON client_delivery_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_client_delivery_preferences_delivery ON client_delivery_preferences(delivery_id);
CREATE INDEX IF NOT EXISTS idx_client_delivery_preferences_date ON client_delivery_preferences(preferred_delivery_date);

-- Table external_delivery_providers (fournisseurs de livraison externes)
CREATE TABLE IF NOT EXISTS external_delivery_providers (
    id SERIAL PRIMARY KEY,
    provider_name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    api_secret VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(255),
    webhook_url TEXT,
    allowed_ips INET[],
    rate_limit_per_hour INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    total_deliveries INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_external_providers_api_key ON external_delivery_providers(api_key);
CREATE INDEX IF NOT EXISTS idx_external_providers_active ON external_delivery_providers(is_active) WHERE is_active = TRUE;

-- Table public_tracking_tokens (tokens de suivi public)
CREATE TABLE IF NOT EXISTS public_tracking_tokens (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    tracking_token VARCHAR(255) UNIQUE NOT NULL,
    provider_id INTEGER REFERENCES external_delivery_providers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    UNIQUE(delivery_id, tracking_token)
);

CREATE INDEX IF NOT EXISTS idx_public_tracking_tokens_token ON public_tracking_tokens(tracking_token);
CREATE INDEX IF NOT EXISTS idx_public_tracking_tokens_delivery ON public_tracking_tokens(delivery_id);

-- Table delivery_payment_reservations (réservations de paiement livraison)
CREATE TABLE IF NOT EXISTS delivery_payment_reservations (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Montants
    product_price_cents BIGINT NOT NULL,
    delivery_cost_cents BIGINT NOT NULL,
    total_amount_cents BIGINT NOT NULL,
    
    -- Mode de facturation
    billing_mode VARCHAR(50) DEFAULT 'standard',
    merchant_pays_delivery BOOLEAN DEFAULT FALSE,
    
    -- Statut de la réservation
    reservation_status VARCHAR(50) DEFAULT 'reserved',
    
    -- Informations de débit
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    debited_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    
    -- Informations de reversement prestataire
    merchant_payout_cents BIGINT,
    commission_cents BIGINT,
    commission_rate DECIMAL(5,4) DEFAULT 0.05,
    merchant_paid_at TIMESTAMPTZ,
    
    -- Métadonnées
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_delivery ON delivery_payment_reservations(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_user ON delivery_payment_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_status ON delivery_payment_reservations(reservation_status);

-- Colonnes pour matching intelligent modes de paiement
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='payment_methods') THEN
        ALTER TABLE users ADD COLUMN payment_methods JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='delivery_payment_reservations' AND column_name='client_payment_method') THEN
        ALTER TABLE delivery_payment_reservations 
        ADD COLUMN client_payment_method JSONB,
        ADD COLUMN merchant_payment_method JSONB,
        ADD COLUMN payout_method_used VARCHAR(50);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_payment_methods ON users USING GIN (payment_methods) WHERE payment_methods != '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_payout_method ON delivery_payment_reservations(payout_method_used);

COMMENT ON TABLE traffic_snapshots IS 'Instantanés de trafic pour optimisation des routes de livraison';
COMMENT ON TABLE terrain_segments IS 'Segments de terrain avec difficulté pour calcul de routes optimisées';
COMMENT ON TABLE video_weekly_reports IS 'Rapports hebdomadaires sur les vidéos générées';
COMMENT ON TABLE service_inventory_overrides IS 'Surcharges d''inventaire externes pour synchronisation';
COMMENT ON TABLE product_delivery_config IS 'Configuration de livraison spécifique par produit';
COMMENT ON TABLE client_delivery_preferences IS 'Préférences de livraison des clients';
COMMENT ON TABLE external_delivery_providers IS 'Fournisseurs de livraison externes (API)';
COMMENT ON TABLE public_tracking_tokens IS 'Tokens de suivi public pour livraisons externes';
COMMENT ON TABLE delivery_payment_reservations IS 'Réservations de paiement pour livraisons';




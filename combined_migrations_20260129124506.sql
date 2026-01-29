-- ============================================================================
-- Migration manuelle combinÃ©e pour crÃ©er les tables manquantes
-- GÃ©nÃ©rÃ© le 2026-01-29 12:45:06
-- ============================================================================
-- ============================================================================
-- Migration: backend/migrations/20260102_create_product_creation_queue.sql
-- ============================================================================
-- Migration: Queue asynchrone pour crÃ©ation de produits
-- âœ… SOLUTION DÃ‰FINITIVE: Ã‰vite les timeouts et les erreurs TLS

CREATE TABLE IF NOT EXISTS product_creation_queue (
    id BIGSERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_data JSONB NOT NULL,
    images_to_process TEXT[] DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 5,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    result_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_queue_status_priority 
    ON product_creation_queue(status, priority, created_at) 
    WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_product_queue_created_at 
    ON product_creation_queue(created_at) 
    WHERE status IN ('completed', 'failed');

CREATE INDEX IF NOT EXISTS idx_product_queue_service_id 
    ON product_creation_queue(service_id) 
    WHERE status = 'pending';

CREATE OR REPLACE FUNCTION cleanup_old_product_creation_jobs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM product_creation_queue
    WHERE status IN ('completed', 'failed')
      AND created_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE product_creation_queue IS 'Queue asynchrone pour crÃ©ation de produits. Ã‰vite les timeouts et erreurs TLS en traitant les crÃ©ations en arriÃ¨re-plan.';
COMMENT ON FUNCTION cleanup_old_product_creation_jobs IS 'Nettoie les jobs de crÃ©ation de produits de plus de 7 jours.';



-- ============================================================================
-- Migration: backend/migrations/20251111001_002_create_live_flash_sales.sql
-- ============================================================================
-- Flash sales for live sessions (promo chrono)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS live_flash_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    promo_price_cfa NUMERIC(14,2) NOT NULL CHECK (promo_price_cfa >= 0),
    stock_target INTEGER NOT NULL CHECK (stock_target > 0),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled' CHECK (
        status IN ('scheduled', 'live', 'ended', 'cancelled')
    ),
    commentary_mode VARCHAR(20) NOT NULL DEFAULT 'host' CHECK (
        commentary_mode IN ('host', 'ai_voice')
    ),
    commentary_interval_seconds INTEGER NOT NULL DEFAULT 60 CHECK (commentary_interval_seconds >= 15),
    ai_voice_profile TEXT,
    scheduled_notification_sent_at TIMESTAMPTZ,
    live_notification_sent_at TIMESTAMPTZ,
    ending_notification_sent_at TIMESTAMPTZ,
    last_commentary_sent_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_live_flash_sales_session
    ON live_flash_sales(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status
    ON live_flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_timing
    ON live_flash_sales(start_at, end_at);

CREATE TABLE IF NOT EXISTS live_flash_sale_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flash_sale_id UUID NOT NULL REFERENCES live_flash_sales(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (flash_sale_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_flash_sale_reservations_flash
    ON live_flash_sale_reservations(flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_live_flash_sale_reservations_user
    ON live_flash_sale_reservations(user_id);

CREATE TABLE IF NOT EXISTS live_flash_sale_commentaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flash_sale_id UUID NOT NULL REFERENCES live_flash_sales(id) ON DELETE CASCADE,
    created_by VARCHAR(20) NOT NULL CHECK (created_by IN ('host', 'ai_voice')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_flash_sale_commentaries_flash
    ON live_flash_sale_commentaries(flash_sale_id, created_at);




-- ============================================================================
-- Migration: backend/migrations/20251115002_create_global_promo_platform.sql
-- ============================================================================
-- Plateforme centralisÃ©e pour les campagnes Black Friday et promos globales
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS global_promo_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT NOT NULL UNIQUE,
    theme TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    recurrence_rule TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'scheduled', 'live', 'archived')
    ),
    config JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_global_promo_events_status
    ON global_promo_events(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_global_promo_events_theme
    ON global_promo_events(theme);

CREATE TABLE IF NOT EXISTS global_promo_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES global_promo_events(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    live_session_id UUID REFERENCES live_sessions(id) ON DELETE SET NULL,
    submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    discount_percentage NUMERIC(5,2) CHECK (
        discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)
    ),
    promo_price_cfa NUMERIC(14,2) CHECK (promo_price_cfa IS NULL OR promo_price_cfa >= 0),
    stock_cap INTEGER CHECK (stock_cap IS NULL OR stock_cap > 0),
    availability VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (
        availability IN ('online', 'live', 'both')
    ),
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'pending_review', 'approved', 'rejected', 'published', 'ended')
    ),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_global_promo_entries_event_status
    ON global_promo_entries(event_id, status);
CREATE INDEX IF NOT EXISTS idx_global_promo_entries_service
    ON global_promo_entries(service_id);
CREATE INDEX IF NOT EXISTS idx_global_promo_entries_live_session
    ON global_promo_entries(live_session_id);

CREATE TABLE IF NOT EXISTS global_promo_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promo_entry_id UUID NOT NULL UNIQUE REFERENCES global_promo_entries(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    availability VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (
        availability IN ('online', 'live', 'both')
    ),
    priority_score INTEGER NOT NULL DEFAULT 0,
    highlighted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_promo_products_priority
    ON global_promo_products(highlighted DESC, priority_score DESC);

ALTER TABLE live_flash_sales
    ADD COLUMN IF NOT EXISTS global_promo_entry_id UUID REFERENCES global_promo_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_flash_sales_global_promo
    ON live_flash_sales(global_promo_entry_id);



-- ============================================================================
-- Migration: backend/migrations/20251115001_create_delivery_matching_tables.sql
-- ============================================================================
-- Migration: couches de matching temps rÃ©el (zones, capacitÃ©, files d'attente)
-- Cette migration structure la donnÃ©e nÃ©cessaire pour le dispatch des coursiers.

-- Enum pour tracer l'Ã©tat du matching
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'delivery_matching_status'
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

COMMENT ON TABLE delivery_zones IS 'Zones opÃ©rationnelles utilisÃ©es pour rÃ©partir les coursiers';
COMMENT ON TABLE courier_zone_assignments IS 'Association many-to-many entre coursiers et zones de livraison';
COMMENT ON TABLE courier_availability_snapshots IS 'InstantanÃ© de disponibilitÃ© couriers (position, charge, statut)';
COMMENT ON TABLE delivery_matching_queue IS 'File d''attente interne avant le matching temps rÃ©el';
COMMENT ON TABLE delivery_matching_events IS 'Historique des dÃ©cisions de matching pour audit et observabilitÃ©';



-- ============================================================================
-- Migration: backend/migrations/20250120_001_add_order_preparation_system.sql
-- ============================================================================
-- Migration: SystÃ¨me de temps de prÃ©paration et disponibilitÃ© par jour
-- Date: 2025-01-20
-- Description: Ajoute colonnes pour temps de prÃ©paration et jours de disponibilitÃ©

-- 1. Ajouter colonnes Ã  product_delivery_config
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER,
-- NULL = utiliser valeur dynamique calculÃ©e par catÃ©gorie
-- Si dÃ©fini, utilise cette valeur spÃ©cifique au produit
ADD COLUMN IF NOT EXISTS max_preparation_time_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS availability_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
ADD COLUMN IF NOT EXISTS is_immediately_available BOOLEAN DEFAULT FALSE;
-- 0=dimanche, 1=lundi, ..., 6=samedi
-- is_immediately_available: TRUE = pas de dÃ©lai de prÃ©paration, matching coursier immÃ©diat

-- 1.1. Table pour stocker les durÃ©es de prÃ©paration observÃ©es par catÃ©gorie
CREATE TABLE IF NOT EXISTS category_preparation_stats (
    id SERIAL PRIMARY KEY,
    category VARCHAR(255) NOT NULL UNIQUE,
    avg_preparation_minutes NUMERIC(10,2) NOT NULL DEFAULT 5.0,
    median_preparation_minutes NUMERIC(10,2) NOT NULL DEFAULT 5.0,
    sample_count INTEGER NOT NULL DEFAULT 0,
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_category_preparation_stats_category 
ON category_preparation_stats(category);

-- 2. Index pour recherche par jours de disponibilitÃ©
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_availability_days 
ON product_delivery_config USING GIN(availability_days);

-- 3. Table commandes avec workflow de prÃ©paration
CREATE TABLE IF NOT EXISTS product_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id),
    product_index INTEGER NOT NULL,
    client_user_id INTEGER NOT NULL REFERENCES users(id),
    provider_user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending', 
    -- pending, validated, preparing, ready, courier_assigned, picked_up, delivered, cancelled, rejected
    preparation_time_minutes INTEGER,
    estimated_ready_at TIMESTAMPTZ,
    validated_at TIMESTAMPTZ,
    validated_by INTEGER REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. Index pour product_orders
CREATE INDEX IF NOT EXISTS idx_product_orders_status 
ON product_orders(status, created_at);

CREATE INDEX IF NOT EXISTS idx_product_orders_provider 
ON product_orders(provider_user_id, status);

CREATE INDEX IF NOT EXISTS idx_product_orders_delivery 
ON product_orders(delivery_id) WHERE delivery_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_orders_estimated_ready 
ON product_orders(estimated_ready_at) WHERE estimated_ready_at IS NOT NULL;

-- 3.1. Ajouter colonne validation_deadline Ã  product_orders pour gÃ©rer les timeouts
ALTER TABLE product_orders
ADD COLUMN IF NOT EXISTS validation_deadline TIMESTAMPTZ;
-- Deadline pour que le prestataire valide la commande

CREATE INDEX IF NOT EXISTS idx_product_orders_validation_deadline 
ON product_orders(validation_deadline) 
WHERE status = 'pending' AND validation_deadline IS NOT NULL;

-- 3.2. Table pour enregistrer les annulations (timeout, rejet, etc.)
CREATE TABLE IF NOT EXISTS order_cancellations (
    id SERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    provider_user_id INTEGER NOT NULL REFERENCES users(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    product_index INTEGER NOT NULL,
    cancellation_type VARCHAR(50) NOT NULL CHECK (cancellation_type IN ('timeout', 'rejected', 'provider_cancelled', 'courier_unavailable')),
    reason TEXT,
    cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_cancellations_provider 
ON order_cancellations(provider_user_id, cancelled_at);

CREATE INDEX IF NOT EXISTS idx_order_cancellations_service_product 
ON order_cancellations(service_id, product_index, cancellation_type);

-- 3.3. Table pour calculer les statistiques d'annulation par produit
CREATE TABLE IF NOT EXISTS product_cancellation_stats (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_cancellations INTEGER NOT NULL DEFAULT 0,
    cancellation_rate NUMERIC(5,2) NOT NULL DEFAULT 0.0, -- Pourcentage
    timeout_cancellations INTEGER NOT NULL DEFAULT 0,
    rejected_cancellations INTEGER NOT NULL DEFAULT 0,
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(service_id, product_index)
);

CREATE INDEX IF NOT EXISTS idx_product_cancellation_stats_rate 
ON product_cancellation_stats(cancellation_rate DESC);

-- 3.4. Table pour vÃ©rification d'identitÃ© du coursier lors du pickup
CREATE TABLE IF NOT EXISTS courier_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    order_id UUID REFERENCES product_orders(id) ON DELETE CASCADE,
    courier_id INTEGER NOT NULL REFERENCES couriers(id),
    verification_code VARCHAR(6) NOT NULL UNIQUE,
    -- Code Ã  6 chiffres pour vÃ©rification (ex: "123456")
    qr_code_data TEXT,
    -- DonnÃ©es du QR code (peut contenir le code + infos livraison)
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    verified_by INTEGER REFERENCES users(id),
    verification_method VARCHAR(50),
    -- 'qr_scan', 'pin_code', 'manual'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courier_verification_delivery 
ON courier_verification_codes(delivery_id);

CREATE INDEX IF NOT EXISTS idx_courier_verification_code 
ON courier_verification_codes(verification_code) 
WHERE verified_at IS NULL AND expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_courier_verification_courier 
ON courier_verification_codes(courier_id, delivery_id);





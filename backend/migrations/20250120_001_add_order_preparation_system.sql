-- Migration: Système de temps de préparation et disponibilité par jour
-- Date: 2025-01-20
-- Description: Ajoute colonnes pour temps de préparation et jours de disponibilité

-- 1. Ajouter colonnes à product_delivery_config
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER,
-- NULL = utiliser valeur dynamique calculée par catégorie
-- Si défini, utilise cette valeur spécifique au produit
ADD COLUMN IF NOT EXISTS max_preparation_time_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS availability_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
ADD COLUMN IF NOT EXISTS is_immediately_available BOOLEAN DEFAULT FALSE;
-- 0=dimanche, 1=lundi, ..., 6=samedi
-- is_immediately_available: TRUE = pas de délai de préparation, matching coursier immédiat

-- 1.1. Table pour stocker les durées de préparation observées par catégorie
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

-- 2. Index pour recherche par jours de disponibilité
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_availability_days 
ON product_delivery_config USING GIN(availability_days);

-- 3. Table commandes avec workflow de préparation
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

-- 3.1. Ajouter colonne validation_deadline à product_orders pour gérer les timeouts
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

-- 3.4. Table pour vérification d'identité du coursier lors du pickup
CREATE TABLE IF NOT EXISTS courier_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    order_id UUID REFERENCES product_orders(id) ON DELETE CASCADE,
    courier_id INTEGER NOT NULL REFERENCES couriers(id),
    verification_code VARCHAR(6) NOT NULL UNIQUE,
    -- Code à 6 chiffres pour vérification (ex: "123456")
    qr_code_data TEXT,
    -- Données du QR code (peut contenir le code + infos livraison)
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


-- Migration: Table external_delivery_providers
-- Date: 2025-01-27
-- Description: API Keys pour prestataires externes (WhatsApp, Facebook, etc.)

CREATE TABLE IF NOT EXISTS external_delivery_providers (
    id SERIAL PRIMARY KEY,
    provider_name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    api_secret VARCHAR(255) NOT NULL,  -- Pour validation
    contact_email VARCHAR(255),
    contact_phone VARCHAR(255),
    webhook_url TEXT,  -- URL pour notifications webhook
    allowed_ips INET[],  -- IPs autorisées (optionnel)
    rate_limit_per_hour INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    total_deliveries INTEGER DEFAULT 0,
    
    -- Métadonnées
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_external_providers_api_key ON external_delivery_providers(api_key);
CREATE INDEX IF NOT EXISTS idx_external_providers_active ON external_delivery_providers(is_active) WHERE is_active = TRUE;


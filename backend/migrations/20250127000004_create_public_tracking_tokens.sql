-- Migration: Table public_tracking_tokens
-- Date: 2025-01-27
-- Description: Tokens publics pour suivi des livraisons externes

CREATE TABLE IF NOT EXISTS public_tracking_tokens (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    tracking_token VARCHAR(255) UNIQUE NOT NULL,
    provider_id INTEGER REFERENCES external_delivery_providers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- Optionnel: expiration du token
    
    UNIQUE(delivery_id, tracking_token)
);

CREATE INDEX IF NOT EXISTS idx_public_tracking_tokens_token ON public_tracking_tokens(tracking_token);
CREATE INDEX IF NOT EXISTS idx_public_tracking_tokens_delivery ON public_tracking_tokens(delivery_id);


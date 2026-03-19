-- Migration: Table public_tracking_tokens
-- Date: 2025-01-27
-- Description: Tokens publics pour suivi des livraisons externes

-- ✅ CORRIGÉ 2026-01-29: Créer la table sans contrainte FK d'abord, puis l'ajouter conditionnellement
CREATE TABLE IF NOT EXISTS public_tracking_tokens (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL,
    tracking_token VARCHAR(255) UNIQUE NOT NULL,
    provider_id INTEGER REFERENCES external_delivery_providers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- Optionnel: expiration du token
    
    UNIQUE(delivery_id, tracking_token)
);

CREATE INDEX IF NOT EXISTS idx_public_tracking_tokens_token ON public_tracking_tokens(tracking_token);
CREATE INDEX IF NOT EXISTS idx_public_tracking_tokens_delivery ON public_tracking_tokens(delivery_id);

-- ✅ CORRIGÉ 2026-01-29: Ajouter la contrainte de clé étrangère seulement si deliveries existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deliveries') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = 'public_tracking_tokens' 
            AND constraint_name = 'public_tracking_tokens_delivery_id_fkey'
        ) THEN
            ALTER TABLE public_tracking_tokens
                ADD CONSTRAINT public_tracking_tokens_delivery_id_fkey
                FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;


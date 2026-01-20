-- Script pour appliquer la migration negotiated_prices sur Render
-- Date: 2026-01-14

-- Créer la table negotiated_prices
CREATE TABLE IF NOT EXISTS negotiated_prices (
    id SERIAL PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER, -- NULL si prix global pour le service
    merchant_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_price_cents BIGINT NOT NULL,
    negotiated_price_cents BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Créer les index
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_conversation ON negotiated_prices(conversation_id);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_service ON negotiated_prices(service_id);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_client_user_id ON negotiated_prices(client_user_id);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_merchant_user_id ON negotiated_prices(merchant_user_id);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_status ON negotiated_prices(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_client ON negotiated_prices(client_user_id, status) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_expires_at ON negotiated_prices(expires_at);

-- Index composite pour requêtes courantes
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_lookup 
ON negotiated_prices(conversation_id, service_id, product_index, client_user_id, status);

-- Contrainte UNIQUE partielle pour éviter les doublons d'offres en attente
-- Note: Les offres précédentes sont annulées avant de créer une nouvelle offre
CREATE UNIQUE INDEX IF NOT EXISTS idx_negotiated_prices_unique_pending
ON negotiated_prices(conversation_id, service_id, COALESCE(product_index, -1), client_user_id)
WHERE status = 'pending';

-- Ajouter la colonne updated_at si elle n'existe pas déjà
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'negotiated_prices' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE negotiated_prices ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Commentaires
COMMENT ON TABLE negotiated_prices IS 'Offres de prix négociés entre prestataire et client';
COMMENT ON COLUMN negotiated_prices.status IS 'pending: en attente, accepted: acceptée, rejected: rejetée, expired: expirée, cancelled: annulée';
COMMENT ON COLUMN negotiated_prices.product_index IS 'Index du produit dans le service (NULL pour le service entier)';







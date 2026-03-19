-- Migration pour créer la table negotiated_prices
-- Date: 2026-01-14
-- Description: Table pour gérer les prix négociés entre prestataire et client

CREATE TABLE IF NOT EXISTS negotiated_prices (
    id SERIAL PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER,
    merchant_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_price_cents BIGINT NOT NULL,
    negotiated_price_cents BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_conversation_id ON negotiated_prices(conversation_id);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_service_id ON negotiated_prices(service_id);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_client_user_id ON negotiated_prices(client_user_id);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_merchant_user_id ON negotiated_prices(merchant_user_id);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_status ON negotiated_prices(status);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_expires_at ON negotiated_prices(expires_at);

-- Index composite pour requêtes courantes
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_lookup 
ON negotiated_prices(conversation_id, service_id, product_index, client_user_id, status);

-- Contrainte UNIQUE pour éviter les doublons (une seule offre en attente par conversation/service/produit/client)
-- Note: Les offres précédentes sont annulées avant de créer une nouvelle offre
CREATE UNIQUE INDEX IF NOT EXISTS idx_negotiated_prices_unique_pending
ON negotiated_prices(conversation_id, service_id, COALESCE(product_index, -1), client_user_id)
WHERE status = 'pending';

-- Commentaires
COMMENT ON TABLE negotiated_prices IS 'Offres de prix négociés entre prestataire et client';
COMMENT ON COLUMN negotiated_prices.status IS 'pending: en attente, accepted: acceptée, rejected: rejetée, expired: expirée, cancelled: annulée';
COMMENT ON COLUMN negotiated_prices.product_index IS 'Index du produit dans le service (NULL pour le service entier)';


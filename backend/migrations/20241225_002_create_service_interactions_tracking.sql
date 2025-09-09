-- Migration pour tracker les interactions utilisateur sur les services

CREATE TABLE IF NOT EXISTS service_interactions_tracking (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL,
    interaction_type VARCHAR(50) NOT NULL, -- 'view', 'click', 'contact', etc.
    tokens_debited BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Index pour eviter les doubles interactions (simplifie)
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_service_per_hour ON service_interactions_tracking
  (user_id, service_id, interaction_type, created_at);

-- Index pour optimiser les requetes anti-spam
CREATE INDEX IF NOT EXISTS idx_service_interactions_user_service ON service_interactions_tracking(user_id, service_id);
CREATE INDEX IF NOT EXISTS idx_service_interactions_created_at ON service_interactions_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_interactions_tokens_debited ON service_interactions_tracking(tokens_debited);

-- Commentaires
COMMENT ON TABLE service_interactions_tracking IS 'Tracking des interactions utilisateur sur les services pour eviter les doubles facturations';
COMMENT ON COLUMN service_interactions_tracking.tokens_debited IS 'Indique si les tokens ont ete debites au prestataire pour cette interaction';

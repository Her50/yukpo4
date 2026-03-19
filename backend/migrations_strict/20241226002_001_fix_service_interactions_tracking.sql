-- Création de la table service_interactions_tracking si elle n'existe pas
CREATE TABLE IF NOT EXISTS service_interactions_tracking (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    interaction_type VARCHAR(50) NOT NULL,
    tokens_debited BOOLEAN DEFAULT FALSE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    -- UNIQUE(user_id, service_id, interaction_type, DATE(created_at)) -- Non supporté par PostgreSQL, à remplacer par une colonne supplémentaire si besoin
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_service_interactions_user_service ON service_interactions_tracking(user_id, service_id);
CREATE INDEX IF NOT EXISTS idx_service_interactions_created_at ON service_interactions_tracking(created_at);

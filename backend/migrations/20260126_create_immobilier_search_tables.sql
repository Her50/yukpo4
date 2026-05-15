-- ✅ NOUVEAU: Tables pour fonctionnalités de recherche immobilière avancée
-- Phase 3.1: Alertes de recherche sauvegardées
-- Phase 3.3: Historique de recherche

-- Table pour alertes de recherche
CREATE TABLE IF NOT EXISTS property_search_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notify_email BOOLEAN NOT NULL DEFAULT true,
    notify_push BOOLEAN NOT NULL DEFAULT true,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_search_alerts_user_id ON property_search_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_property_search_alerts_is_active ON property_search_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_property_search_alerts_last_checked ON property_search_alerts(last_checked_at);

-- Table pour historique de recherche
CREATE TABLE IF NOT EXISTS property_search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    search_query TEXT,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    results_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_search_history_user_id ON property_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_property_search_history_created_at ON property_search_history(created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_property_search_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_search_alerts_updated_at ON property_search_alerts;

CREATE TRIGGER trg_property_search_alerts_updated_at
    BEFORE UPDATE ON property_search_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_property_search_alerts_updated_at();


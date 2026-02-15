-- Migration: Rapports automatisés pour publicités
-- Date: 2025-01-XX
-- Objectif: Système de rapports automatisés par email

-- Table pour les rapports automatisés
CREATE TABLE IF NOT EXISTS automated_reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
    format VARCHAR(20) NOT NULL, -- 'csv', 'excel', 'pdf'
    email VARCHAR(255),
    metrics JSONB DEFAULT '[]', -- Liste des métriques à inclure
    is_active BOOLEAN DEFAULT true,
    last_sent_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index
CREATE INDEX IF NOT EXISTS idx_automated_reports_user_id ON automated_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_automated_reports_frequency ON automated_reports(frequency);
CREATE INDEX IF NOT EXISTS idx_automated_reports_active ON automated_reports(is_active);
CREATE INDEX IF NOT EXISTS idx_automated_reports_last_sent ON automated_reports(last_sent_at);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_automated_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_automated_reports_updated_at ON automated_reports;
CREATE TRIGGER trigger_automated_reports_updated_at
    BEFORE UPDATE ON automated_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_automated_reports_updated_at();

-- Commentaires
COMMENT ON TABLE automated_reports IS 'Rapports automatisés pour publicités (daily, weekly, monthly)';
COMMENT ON COLUMN automated_reports.metrics IS 'Liste des métriques à inclure: views, clicks, conversions, roi, etc.';


-- Migration: Table pour brouillons de services spécialisés
-- Date: 2025-01-28
-- Description: Permet la sauvegarde automatique de brouillons pendant la création

CREATE TABLE IF NOT EXISTS specialized_services_drafts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_type_draft UNIQUE(user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON specialized_services_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_type ON specialized_services_drafts(type);
CREATE INDEX IF NOT EXISTS idx_drafts_updated_at ON specialized_services_drafts(updated_at DESC);

COMMENT ON TABLE specialized_services_drafts IS 
    'Brouillons de services spécialisés sauvegardés automatiquement pendant la création';


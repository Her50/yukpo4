-- Migration: Système de tracking avancé (comme Facebook Pixel)
-- Date: 2025-01-XX
-- Objectif: Implémenter un système de tracking avancé pour retargeting et audiences

-- Table pour les événements pixel
CREATE TABLE IF NOT EXISTS pixel_events (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL, -- 'PageView', 'ViewContent', 'AddToCart', 'Purchase', etc.
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    event_id VARCHAR(255) UNIQUE NOT NULL, -- ID unique pour déduplication
    event_time BIGINT NOT NULL, -- Timestamp Unix
    action_source VARCHAR(50) NOT NULL DEFAULT 'app', -- 'website', 'app', 'email', etc.
    custom_data JSONB DEFAULT '{}', -- Données personnalisées
    user_data JSONB DEFAULT '{}', -- Données utilisateur (email, phone, etc.)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_pixel_events_user_id ON pixel_events(user_id);
CREATE INDEX IF NOT EXISTS idx_pixel_events_event_name ON pixel_events(event_name);
CREATE INDEX IF NOT EXISTS idx_pixel_events_event_time ON pixel_events(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_pixel_events_user_event ON pixel_events(user_id, event_name);
CREATE INDEX IF NOT EXISTS idx_pixel_events_event_id ON pixel_events(event_id);

-- Index GIN pour recherche dans JSONB
CREATE INDEX IF NOT EXISTS idx_pixel_events_custom_data_gin ON pixel_events USING GIN(custom_data);
CREATE INDEX IF NOT EXISTS idx_pixel_events_user_data_gin ON pixel_events USING GIN(user_data);

-- Table pour les audiences personnalisées (amélioration)
CREATE TABLE IF NOT EXISTS publicite_audiences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'custom', 'lookalike', 'saved'
    source_audience_id INTEGER REFERENCES publicite_audiences(id) ON DELETE SET NULL, -- Pour lookalike
    similarity DECIMAL(3,2), -- Pour lookalike (0.01 à 1.0)
    user_ids JSONB DEFAULT '[]', -- Liste des user_ids
    metadata JSONB DEFAULT '{}', -- Métadonnées supplémentaires
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index pour audiences
CREATE INDEX IF NOT EXISTS idx_publicite_audiences_user_id ON publicite_audiences(user_id);
CREATE INDEX IF NOT EXISTS idx_publicite_audiences_type ON publicite_audiences(type);
CREATE INDEX IF NOT EXISTS idx_publicite_audiences_user_ids_gin ON publicite_audiences USING GIN(user_ids);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_publicite_audiences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_publicite_audiences_updated_at ON publicite_audiences;
CREATE TRIGGER trigger_publicite_audiences_updated_at
    BEFORE UPDATE ON publicite_audiences
    FOR EACH ROW
    EXECUTE FUNCTION update_publicite_audiences_updated_at();

-- Commentaires
COMMENT ON TABLE pixel_events IS 'Événements de tracking pixel pour retargeting et audiences';
COMMENT ON TABLE publicite_audiences IS 'Audiences personnalisées et lookalike pour publicités';
COMMENT ON FUNCTION update_publicite_audiences_updated_at IS 'Met à jour updated_at automatiquement';


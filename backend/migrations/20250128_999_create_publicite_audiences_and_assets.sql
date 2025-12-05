-- Migration: Création des tables pour audiences personnalisées et bibliothèque de médias
-- Date: 2025-01-XX

-- Table pour les audiences personnalisées
CREATE TABLE IF NOT EXISTS publicite_audiences (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('lookalike', 'custom', 'retargeting')),
    source VARCHAR(50) NOT NULL CHECK (source IN ('website', 'app', 'email', 'phone', 'csv', 'pixel', 'lookalike')),
    size INTEGER NOT NULL DEFAULT 0,
    similarity INTEGER CHECK (similarity >= 1 AND similarity <= 10), -- Pour lookalike (1-10)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'error')),
    data JSONB, -- Pour stocker les données custom (emails, téléphones, etc.)
    source_audience_id VARCHAR(255), -- Pour lookalike: référence à l'audience source
    metadata JSONB, -- Métadonnées supplémentaires
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table pour la bibliothèque de médias (assets)
CREATE TABLE IF NOT EXISTS publicite_assets (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('image', 'video')),
    url TEXT NOT NULL,
    thumbnail TEXT,
    name VARCHAR(255) NOT NULL,
    size INTEGER NOT NULL DEFAULT 0, -- Taille en bytes
    tags TEXT[], -- Tags pour recherche
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB, -- Métadonnées (dimensions, durée, etc.)
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_publicite_audiences_user_id ON publicite_audiences(user_id);
CREATE INDEX IF NOT EXISTS idx_publicite_audiences_type ON publicite_audiences(type);
CREATE INDEX IF NOT EXISTS idx_publicite_audiences_status ON publicite_audiences(status);
CREATE INDEX IF NOT EXISTS idx_publicite_audiences_created_at ON publicite_audiences(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_publicite_assets_user_id ON publicite_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_publicite_assets_type ON publicite_assets(type);
CREATE INDEX IF NOT EXISTS idx_publicite_assets_created_at ON publicite_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publicite_assets_tags ON publicite_assets USING GIN(tags);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_publicite_audiences_updated_at BEFORE UPDATE ON publicite_audiences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_publicite_assets_updated_at BEFORE UPDATE ON publicite_assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Commentaires pour documentation
COMMENT ON TABLE publicite_audiences IS 'Audiences personnalisées pour le ciblage publicitaire (lookalike, custom, retargeting)';
COMMENT ON TABLE publicite_assets IS 'Bibliothèque de médias réutilisables pour les publicités (images, vidéos)';
COMMENT ON COLUMN publicite_audiences.similarity IS 'Niveau de similarité pour audiences lookalike (1=large, 10=très similaire)';
COMMENT ON COLUMN publicite_audiences.data IS 'Données de l''audience custom (emails, téléphones, etc.)';
COMMENT ON COLUMN publicite_assets.metadata IS 'Métadonnées du média (dimensions, durée vidéo, format, etc.)';


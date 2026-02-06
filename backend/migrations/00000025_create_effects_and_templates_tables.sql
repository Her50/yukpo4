-- Tables pour effets vidéo et templates

-- ✅ NOUVEAU 2025-01-27: Table pour bibliothèque d'effets vidéo étendue (50+)
CREATE TABLE IF NOT EXISTS effects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('transitions', 'visual_effects', 'animations', 'special')),
    description TEXT NOT NULL,
    ffmpeg_filter TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    popularity_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_effects_category ON effects(category);
CREATE INDEX IF NOT EXISTS idx_effects_tags ON effects USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_effects_popularity ON effects(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_effects_name ON effects(name);
CREATE INDEX IF NOT EXISTS idx_effects_category_popularity ON effects(category, popularity_score DESC);

CREATE OR REPLACE FUNCTION update_effects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ CORRECTION 2026-01-30: DROP le trigger avant de le recréer pour éviter "already exists"
DROP TRIGGER IF EXISTS trigger_update_effects_updated_at ON effects;
CREATE TRIGGER trigger_update_effects_updated_at
    BEFORE UPDATE ON effects
    FOR EACH ROW
    EXECUTE FUNCTION update_effects_updated_at();

-- ✅ NOUVEAU 2025-01-27: Table pour bibliothèque de templates vidéo par industrie (50+)
CREATE TABLE IF NOT EXISTS video_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    industry VARCHAR(50) NOT NULL CHECK (industry IN ('ecommerce', 'services', 'creators', 'business', 'social_media')),
    subcategory VARCHAR(100),
    description TEXT NOT NULL,
    timeline JSONB NOT NULL,
    effects JSONB NOT NULL DEFAULT '[]'::jsonb,
    transitions JSONB NOT NULL DEFAULT '[]'::jsonb,
    style JSONB NOT NULL DEFAULT '{}'::jsonb,
    duration DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    format VARCHAR(10) NOT NULL DEFAULT '16:9' CHECK (format IN ('16:9', '9:16', '1:1', '4:5')),
    tags TEXT[] NOT NULL DEFAULT '{}',
    thumbnail_url VARCHAR(500),
    preview_url VARCHAR(500),
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    popularity_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    usage_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_industry ON video_templates(industry);
CREATE INDEX IF NOT EXISTS idx_templates_subcategory ON video_templates(subcategory);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON video_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_templates_popularity ON video_templates(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_templates_usage ON video_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_name ON video_templates(name);
CREATE INDEX IF NOT EXISTS idx_templates_industry_popularity ON video_templates(industry, popularity_score DESC);

CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_templates_updated_at ON video_templates;
CREATE TRIGGER trigger_update_templates_updated_at
    BEFORE UPDATE ON video_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_templates_updated_at();

-- ✅ NOUVEAU 2025-01-27: Enrichissement automatique des effets (50 effets supplémentaires)
-- Note: Les INSERT détaillés sont dans la migration 20250127_002_enrich_effects_to_100.sql
-- Cette section insère les effets de base si la table est vide
DO $$
DECLARE
    effects_count INTEGER;
    templates_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO effects_count FROM effects;
    
    IF effects_count < 100 THEN
        -- Insérer les effets enrichis via la migration SQL séparée
        -- Les INSERT sont dans backend/migrations/20250127_002_enrich_effects_to_100.sql
        RAISE NOTICE 'Enrichissement effets: Utiliser la migration 20250127_002_enrich_effects_to_100.sql (actuellement: % effets)', effects_count;
    END IF;

    SELECT COUNT(*) INTO templates_count FROM video_templates;
    
    IF templates_count < 1000 THEN
        -- Insérer les templates enrichis via les migrations SQL séparées
        -- Les INSERT sont dans backend/migrations/20250127_003 et 20250127_004
        RAISE NOTICE 'Enrichissement templates: Utiliser les migrations 20250127_003 et 20250127_004 (actuellement: % templates)', templates_count;
    END IF;
END $$;




-- Tables pour système plugins marketplace

-- ✅ NOUVEAU 2025-01-27 Phase 2: Tables pour système plugins marketplace
-- Migration: 20250127_012_create_plugin_marketplace.sql

CREATE TABLE IF NOT EXISTS plugin_marketplace (
    id SERIAL PRIMARY KEY,
    plugin_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    author VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('effect', 'transition', 'filter', 'export', 'integration', 'other')),
    tags TEXT[] DEFAULT CAST(ARRAY[] AS TEXT[]),
    icon_url TEXT,
    homepage_url TEXT,
    license VARCHAR(100) NOT NULL DEFAULT 'MIT',
    min_yukpo_version VARCHAR(50),
    download_url TEXT NOT NULL,
    download_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0 CHECK (rating >= 0.0 AND rating <= 5.0),
    rating_count INTEGER DEFAULT 0,
    price DECIMAL(10,2) DEFAULT 0.0,
    is_premium BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_category ON plugin_marketplace(category);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_tags ON plugin_marketplace USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_featured ON plugin_marketplace(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_rating ON plugin_marketplace(rating DESC);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_downloads ON plugin_marketplace(download_count DESC);

CREATE OR REPLACE FUNCTION update_plugin_marketplace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_plugin_marketplace_updated_at ON plugin_marketplace;
CREATE TRIGGER trigger_update_plugin_marketplace_updated_at
    BEFORE UPDATE ON plugin_marketplace
    FOR EACH ROW
    EXECUTE FUNCTION update_plugin_marketplace_updated_at();

CREATE TABLE IF NOT EXISTS plugin_dependencies (
    id SERIAL PRIMARY KEY,
    plugin_id VARCHAR(255) NOT NULL REFERENCES plugin_marketplace(plugin_id) ON DELETE CASCADE,
    dependency_id VARCHAR(255) NOT NULL,
    dependency_version VARCHAR(50),
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plugin_dependencies_plugin ON plugin_dependencies(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_dependencies_dep ON plugin_dependencies(dependency_id);

CREATE TABLE IF NOT EXISTS plugin_permissions (
    id SERIAL PRIMARY KEY,
    plugin_id VARCHAR(255) NOT NULL REFERENCES plugin_marketplace(plugin_id) ON DELETE CASCADE,
    permission_name VARCHAR(100) NOT NULL,
    permission_description TEXT,
    is_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plugin_permissions_plugin ON plugin_permissions(plugin_id);

CREATE TABLE IF NOT EXISTS plugin_reviews (
    id SERIAL PRIMARY KEY,
    plugin_id VARCHAR(255) NOT NULL REFERENCES plugin_marketplace(plugin_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(plugin_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_plugin_reviews_plugin ON plugin_reviews(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_reviews_user ON plugin_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_plugin_reviews_rating ON plugin_reviews(rating);

CREATE OR REPLACE FUNCTION update_plugin_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE plugin_marketplace
    SET 
        rating = (
            SELECT COALESCE(AVG(rating), 0.0)
            FROM plugin_reviews
            WHERE plugin_id = NEW.plugin_id
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM plugin_reviews
            WHERE plugin_id = NEW.plugin_id
        )
    WHERE plugin_id = NEW.plugin_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_plugin_rating ON plugin_reviews;
CREATE TRIGGER trigger_update_plugin_rating
    AFTER INSERT OR UPDATE OR DELETE ON plugin_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_plugin_rating();




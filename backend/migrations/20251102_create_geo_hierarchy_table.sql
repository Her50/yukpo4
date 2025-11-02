-- Migration pour créer la table geo_hierarchy
-- Cette table stocke la hiérarchie géographique des lieux avec GeoNames

CREATE TABLE IF NOT EXISTS geo_hierarchy (
    id SERIAL PRIMARY KEY,
    geoname_id BIGINT UNIQUE NOT NULL,
    place_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    feature_code TEXT,
    admin_level INTEGER DEFAULT 0,
    is_leaf BOOLEAN DEFAULT FALSE,
    parent_country TEXT,
    parent_country_code TEXT,
    location_vector TEXT[] NOT NULL DEFAULT '{}',
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7),
    population INTEGER,
    timezone TEXT,
    times_used INTEGER DEFAULT 1,
    last_enriched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_place_name ON geo_hierarchy(place_name);
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_geoname_id ON geo_hierarchy(geoname_id);
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_country ON geo_hierarchy(parent_country);
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_location_vector ON geo_hierarchy USING GIN(location_vector);
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_times_used ON geo_hierarchy(times_used DESC);

-- Fonction pour calculer le score de localisation (utilisée dans autocomplete_controller.rs)
CREATE OR REPLACE FUNCTION calculate_location_score(
    reference_location TEXT,
    location_vector TEXT[],
    chosen_location TEXT
) RETURNS FLOAT AS $$
DECLARE
    score FLOAT := 0.0;
BEGIN
    -- Si la location de référence est dans le vecteur, augmenter le score
    IF reference_location = ANY(location_vector) THEN
        score := score + 0.5;
    END IF;
    
    -- Si la chosen_location correspond exactement
    IF chosen_location = reference_location THEN
        score := score + 0.5;
    END IF;
    
    -- Si la location de référence est proche (même pays)
    IF EXISTS (
        SELECT 1 FROM unnest(location_vector) v 
        WHERE v ILIKE '%' || reference_location || '%'
    ) THEN
        score := score + 0.2;
    END IF;
    
    RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON TABLE geo_hierarchy IS 'Hiérarchie géographique des lieux avec GeoNames API';
COMMENT ON COLUMN geo_hierarchy.location_vector IS 'Vecteur bidirectionnel: [Choix, Enfants..., Parents...]';
COMMENT ON COLUMN geo_hierarchy.is_leaf IS 'Lieu terminal (sans enfants valides)';
COMMENT ON COLUMN geo_hierarchy.times_used IS 'Nombre de fois que ce lieu a été utilisé (pour cache intelligent)';


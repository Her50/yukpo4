-- ✅ Migration : Table pour stocker toutes les données Google Places
-- Évite de perdre les données volumineuses (reviews, photos, editorial_summary)
-- et permet de garder services.data léger (< 8191 bytes)

CREATE TABLE IF NOT EXISTS google_places_data (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    place_id TEXT NOT NULL,
    display_name TEXT,
    formatted_address TEXT,
    location_vector TEXT[], -- Array de strings pour la hiérarchie de localisation
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    types TEXT[], -- Array des types de lieu
    primary_type TEXT,
    primary_type_display_name TEXT,
    rating DOUBLE PRECISION,
    rating_count INTEGER,
    price_level TEXT,
    business_status TEXT,
    serves_cuisine TEXT[], -- Array des cuisines servies
    website_uri TEXT,
    google_maps_uri TEXT,
    international_phone_number TEXT,
    national_phone_number TEXT,
    editorial_summary TEXT, -- Résumé éditorial (peut être long)
    current_opening_hours JSONB, -- Horaires actuels (JSON complexe)
    regular_opening_hours JSONB, -- Horaires réguliers (JSON complexe)
    photos JSONB, -- Array de photos avec métadonnées
    country TEXT,
    country_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index pour recherche rapide
    CONSTRAINT unique_service_place UNIQUE (service_id, place_id)
);

-- Index pour recherche par service
CREATE INDEX IF NOT EXISTS idx_google_places_data_service_id ON google_places_data(service_id);

-- Index pour recherche par place_id (si besoin de retrouver un lieu)
CREATE INDEX IF NOT EXISTS idx_google_places_data_place_id ON google_places_data(place_id);

-- Index GIN pour recherche dans location_vector
CREATE INDEX IF NOT EXISTS idx_google_places_data_location_vector ON google_places_data USING GIN(location_vector);

-- Index GIN pour recherche dans types
CREATE INDEX IF NOT EXISTS idx_google_places_data_types ON google_places_data USING GIN(types);

-- Index GIN pour recherche dans serves_cuisine
CREATE INDEX IF NOT EXISTS idx_google_places_data_cuisine ON google_places_data USING GIN(serves_cuisine);

-- Commentaire
COMMENT ON TABLE google_places_data IS 'Stocke toutes les données Google Places pour éviter de surcharger services.data';
COMMENT ON COLUMN google_places_data.service_id IS 'Lien vers le service';
COMMENT ON COLUMN google_places_data.place_id IS 'Identifiant unique Google Places';
COMMENT ON COLUMN google_places_data.editorial_summary IS 'Résumé éditorial complet (peut être long)';
COMMENT ON COLUMN google_places_data.photos IS 'Array JSON des photos Google Places avec métadonnées';


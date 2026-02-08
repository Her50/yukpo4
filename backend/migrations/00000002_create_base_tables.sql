-- Migration unifiée : création de toutes les tables et colonnes importantes pour Yukpo

-- Table users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    nom VARCHAR(255),
    prenom VARCHAR(255),
    nom_complet VARCHAR(255),
    photo_profil VARCHAR(500),
    avatar_url VARCHAR(500),
    is_provider BOOLEAN NOT NULL DEFAULT FALSE,
    tokens_balance BIGINT NOT NULL DEFAULT 0,
    token_price_user DOUBLE PRECISION NOT NULL,
    token_price_provider DOUBLE PRECISION NOT NULL,
    commission_pct REAL NOT NULL,
    preferred_lang TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    gps VARCHAR(255),
    gps_consent BOOLEAN DEFAULT TRUE,
    -- ✅ 2025-11-27 : Groupe sanguin (optionnel, peut être renseigné volontairement)
    groupe_sanguin VARCHAR(5) CHECK (groupe_sanguin IS NULL OR groupe_sanguin IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'))
);
ALTER TABLE users ALTER COLUMN gps_consent SET DEFAULT TRUE;

-- ✅ 2025-01-29 : Table user_documents pour KYC (vérification identité conducteur)
CREATE TABLE IF NOT EXISTS user_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('permis', 'cni', 'assurance', 'passeport', 'carte_grise')),
    document_url TEXT NOT NULL,
    document_number TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    verified_at TIMESTAMPTZ,
    verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    expiry_date DATE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Un seul document de chaque type par utilisateur
    UNIQUE(user_id, document_type)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_status ON user_documents(status);
CREATE INDEX IF NOT EXISTS idx_user_documents_type ON user_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_user_documents_user_status ON user_documents(user_id, status);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_user_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ CORRECTION 2026-01-30: DROP le trigger avant de le recréer pour éviter "already exists"
DROP TRIGGER IF EXISTS trigger_update_user_documents_updated_at ON user_documents;
CREATE TRIGGER trigger_update_user_documents_updated_at
    BEFORE UPDATE ON user_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_user_documents_updated_at();

-- Commentaires
COMMENT ON TABLE user_documents IS 'Documents d''identité utilisateur pour vérification KYC';
COMMENT ON COLUMN user_documents.document_type IS 'Type de document: permis, cni, assurance, passeport, carte_grise';
COMMENT ON COLUMN user_documents.status IS 'Statut: pending (en attente), approved (approuvé), rejected (rejeté), expired (expiré)';
COMMENT ON COLUMN user_documents.verified_by IS 'ID de l''admin qui a vérifié le document (NULL si vérification automatique)';
COMMENT ON COLUMN user_documents.metadata IS 'Métadonnées additionnelles (ex: données extraites par OCR, scores de confiance KYC)';

-- Table services
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    auto_deactivate_at TIMESTAMPTZ,
    last_reactivated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_tarissable BOOLEAN,
    vitesse_tarissement VARCHAR(255),
    active_days INTEGER,
    category VARCHAR(255),
    specialized_type VARCHAR(50),
    last_alert_sent_at TIMESTAMP,
    gps VARCHAR(255)  -- ✅ Colonne GPS pour géolocalisation (format: "lat,lng")
);

-- Table media
CREATE TABLE IF NOT EXISTS media (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_id TEXT,
    product_index INTEGER,
    type TEXT NOT NULL,
    path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    media_type TEXT,
    file_size BIGINT,
    file_format TEXT,
    is_main_image BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    ai_description TEXT,
    ai_tags TEXT[],
    ai_category VARCHAR(100),
    ai_metadata JSONB,
    ai_analyzed_at TIMESTAMPTZ,
    ai_model_used VARCHAR(100),
    ai_confidence DOUBLE PRECISION
);
-- Contrainte sur media_type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'media_type_check' AND table_name = 'media'
    ) THEN
        ALTER TABLE media ADD CONSTRAINT media_type_check CHECK (media_type IN ('image', 'video', 'audio'));
    END IF;
END $$;
-- Index sur service_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_media_service_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_media_service_id ON media (service_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_media_product_id ON media (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_product_index ON media (product_index) WHERE product_index IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_service_product ON media (service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_media_main_image ON media (product_id, is_main_image) WHERE is_main_image = TRUE;
CREATE INDEX IF NOT EXISTS idx_media_product_display ON media (product_id, display_order) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_ai_description_fulltext
    ON media USING GIN (to_tsvector('french', COALESCE(ai_description, '')));
CREATE INDEX IF NOT EXISTS idx_media_ai_tags_gin ON media USING GIN (ai_tags);
CREATE INDEX IF NOT EXISTS idx_media_ai_category ON media(ai_category) WHERE ai_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_ai_metadata_gin ON media USING GIN (ai_metadata);

COMMENT ON COLUMN media.product_id IS 'ID du produit spécifique auquel ce média appartient';
COMMENT ON COLUMN media.product_index IS 'Index du produit dans service.data.produits[] (0-based)';
COMMENT ON COLUMN media.is_main_image IS 'Indique si ce média est l''image principale du produit';
COMMENT ON COLUMN media.display_order IS 'Ordre d''affichage du média pour un produit';
COMMENT ON COLUMN media.ai_description IS 'Description générée par IA pour recherche full-text';
COMMENT ON COLUMN media.ai_tags IS 'Tags IA utilisés pour le matching';
COMMENT ON COLUMN media.ai_category IS 'Catégorie détectée automatiquement';
COMMENT ON COLUMN media.ai_metadata IS 'Métadonnées IA (marque, couleurs, caractéristiques...)';
COMMENT ON COLUMN media.ai_analyzed_at IS 'Date de la dernière analyse IA';
COMMENT ON COLUMN media.ai_model_used IS 'Modèle IA utilisé';
COMMENT ON COLUMN media.ai_confidence IS 'Score de confiance de l''analyse IA';

-- Table google_places_data
-- Stocke toutes les données Google Places pour éviter de surcharger services.data
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

COMMENT ON TABLE google_places_data IS 'Stocke toutes les données Google Places pour éviter de surcharger services.data';
COMMENT ON COLUMN google_places_data.service_id IS 'Lien vers le service';
COMMENT ON COLUMN google_places_data.place_id IS 'Identifiant unique Google Places';
COMMENT ON COLUMN google_places_data.editorial_summary IS 'Résumé éditorial complet (peut être long)';
COMMENT ON COLUMN google_places_data.photos IS 'Array JSON des photos Google Places avec métadonnées';






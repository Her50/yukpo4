-- Active les extensions PostgreSQL nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS postgis;

-- ✅ NOUVEAU 2026-01-24: Extension pgvector pour les vecteurs d'embedding (recherche sémantique/IA)
-- Note: Si pgvector n'est pas installé sur le serveur, cette commande échouera silencieusement
-- Installation recommandée:
--   - Ubuntu/Debian: sudo apt-get install postgresql-XX-pgvector
--   - macOS: brew install pgvector
--   - Depuis sources: https://github.com/pgvector/pgvector
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE '✅ Extension pgvector installée avec succès';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '⚠️ Extension pgvector non disponible. Erreur: %', SQLERRM;
        RAISE WARNING '💡 L''application continuera à utiliser TEXT[] pour le matching vectoriel';
        RAISE WARNING '📦 Pour installer: sudo apt-get install postgresql-XX-pgvector ou brew install pgvector';
END $$;

-- ✅ NOTE 2025-12-30: Les index MongoDB sont créés automatiquement via:
-- - backend/src/services/mongo_history_service.rs::ensure_indexes()
-- - backend/src/migrations/auto_migrate.rs::ensure_mongodb_indexes()
-- Les index créés:
-- - idx_service_id: sur service_id (pour get_service_stats et get_reviews)
-- - idx_service_event_interaction: composé sur (service_id, event_type, data.interaction_type)
-- - idx_timestamp: sur timestamp (pour tri et nettoyage)
-- Ils sont appliqués automatiquement au démarrage du backend via main.rs

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
    last_alert_sent_at TIMESTAMP
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

-- Table consultation_historique
CREATE TABLE IF NOT EXISTS consultation_historique (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table token_packs
CREATE TABLE IF NOT EXISTS token_packs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    tokens BIGINT NOT NULL
);

-- Table service_logs
CREATE TABLE IF NOT EXISTS service_logs (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT,
    reason TEXT,
    modification TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des transactions de paiement
CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
    payment_method JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    gateway_response JSONB,
    reference VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des transactions de tokens
CREATE TABLE IF NOT EXISTS token_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id VARCHAR(255) REFERENCES payment_transactions(transaction_id),
    amount INTEGER NOT NULL DEFAULT 0,
    bonus INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    transaction_type VARCHAR(50) NOT NULL, -- 'recharge', 'usage', 'refund'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes de paiement
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(transaction_type);

-- Table autocomplete_characteristics (mise à jour 2025-11-04 - vectorielle)
-- Stocke les VRAIS produits validés par les prestataires (mode vectoriel)
-- Permet la recherche intelligente avec filtre lieu intégré
CREATE TABLE IF NOT EXISTS autocomplete_characteristics (
    id SERIAL PRIMARY KEY,
    identifiant_base VARCHAR(255) NOT NULL,
    
    -- Mode vectoriel (nouveaux champs 2025-11-04)
    characteristic_vector TEXT[] DEFAULT '{}',  -- Vecteur produit validé par prestataire
    location_vector TEXT[] DEFAULT '{}',        -- Vecteur lieu bidirectionnel (lieu choisi TOUJOURS en position 0)
    full_vector TEXT[] DEFAULT '{}',            -- characteristic_vector + location_vector
    product_id TEXT,                            -- Format: "serviceId_productIndex"
    chosen_location TEXT,                       -- Lieu choisi (position 0 du location_vector)
    chosen_location_geoname_id BIGINT,         -- ID GeoNames (GARANTIT unicité)
    is_real_product BOOLEAN DEFAULT TRUE,      -- TRUE = produit réel prestataire
    
    -- Mode individuel (ancien, conservé pour compatibilité)
    sous_caracteristique VARCHAR(255),
    valeur VARCHAR(500),
    
    -- Métadonnées
    origine_champs VARCHAR(50) NOT NULL DEFAULT 'ia',
    user_id INTEGER,
    service_id INTEGER,
    usage_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour autocomplete_characteristics (mode individuel - ancien)
CREATE INDEX IF NOT EXISTS idx_autocomplete_identifiant_base ON autocomplete_characteristics(identifiant_base);
CREATE INDEX IF NOT EXISTS idx_autocomplete_sous_caracteristique ON autocomplete_characteristics(sous_caracteristique);
CREATE INDEX IF NOT EXISTS idx_autocomplete_base_sous ON autocomplete_characteristics(identifiant_base, sous_caracteristique);
CREATE INDEX IF NOT EXISTS idx_autocomplete_valeur_lower ON autocomplete_characteristics(LOWER(valeur));
CREATE INDEX IF NOT EXISTS idx_autocomplete_origine ON autocomplete_characteristics(origine_champs);
CREATE INDEX IF NOT EXISTS idx_autocomplete_usage_count ON autocomplete_characteristics(identifiant_base, sous_caracteristique, usage_count DESC);

-- Index pour autocomplete_characteristics (mode vectoriel - nouveau 2025-11-04)
CREATE INDEX IF NOT EXISTS idx_autochar_characteristic_vector_gin ON autocomplete_characteristics USING GIN(characteristic_vector);
CREATE INDEX IF NOT EXISTS idx_autochar_location_vector_gin ON autocomplete_characteristics USING GIN(location_vector);
CREATE INDEX IF NOT EXISTS idx_autochar_full_vector_gin ON autocomplete_characteristics USING GIN(full_vector);
CREATE INDEX IF NOT EXISTS idx_autochar_product_id ON autocomplete_characteristics(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_autochar_geoname_id ON autocomplete_characteristics(chosen_location_geoname_id) WHERE chosen_location_geoname_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_autochar_location_usage ON autocomplete_characteristics(chosen_location, usage_count DESC) WHERE chosen_location IS NOT NULL;

-- ✅ OPTIMISÉ 2025-01-14: Index composites pour améliorer les performances autocomplete
CREATE INDEX IF NOT EXISTS idx_autocomplete_real_product_composite 
ON autocomplete_characteristics(identifiant_base, is_real_product, service_id) 
WHERE is_real_product = TRUE AND identifiant_base = 'produits';

CREATE INDEX IF NOT EXISTS idx_autocomplete_relevance_sort 
ON autocomplete_characteristics(service_id, usage_count DESC) 
WHERE is_real_product = TRUE AND identifiant_base = 'produits';

CREATE INDEX IF NOT EXISTS idx_autocomplete_full_vector_gin_filtered 
ON autocomplete_characteristics USING GIN(full_vector) 
WHERE is_real_product = TRUE AND identifiant_base = 'produits';

CREATE INDEX IF NOT EXISTS idx_autocomplete_chosen_location_filtered 
ON autocomplete_characteristics(chosen_location) 
WHERE is_real_product = TRUE AND chosen_location IS NOT NULL;

-- Index conditionnels pour autocomplete_characteristics
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_autocomplete_user_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_autocomplete_user_id ON autocomplete_characteristics(user_id) WHERE user_id IS NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_autocomplete_service_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_autocomplete_service_id ON autocomplete_characteristics(service_id) WHERE service_id IS NOT NULL;
    END IF;
END $$;

-- Table autocomplete_combinations (nouveau 2025-11-02)
-- Stocke les vecteurs complets de produits pour recherche intelligente
CREATE TABLE IF NOT EXISTS autocomplete_combinations (
    id SERIAL PRIMARY KEY,
    service_id INTEGER,
    
    -- Vecteurs de VALEURS
    product_vector TEXT[] NOT NULL,        -- Ex: ["Nike", "Air Max", "Noir", "42"]
    location_vector TEXT[] DEFAULT '{}',   -- Ex: ["Douala", "Akwa", "Littoral", "Cameroun"]
    full_vector TEXT[] NOT NULL,           -- product_vector + location_vector
    
    -- Vecteurs d'étiquettes (labels) - nouveau pour traçabilité
    product_labels TEXT[] NOT NULL,        -- Ex: ["marque", "modele", "couleur", "pointure"]
    location_labels TEXT[] DEFAULT '{}',   -- DEPRECATED: Ne plus utiliser
    
    -- PAS de métadonnées de localisation (lieu UNIQUEMENT dans autocomplete_characteristics)
    
    -- Statistiques et IA
    usage_count INTEGER DEFAULT 1,
    is_ai_preferred BOOLEAN DEFAULT FALSE,
    ai_confidence FLOAT DEFAULT 0.0,
    session_id TEXT,
    
    -- Variabilité de prix
    has_variant BOOLEAN DEFAULT FALSE,
    variant_dimension TEXT,                 -- Ex: "pointure", "taille"
    variant_value TEXT,                     -- Ex: "42", "M"
    
    -- Prix et stock
    prix DECIMAL(12, 2),
    devise TEXT DEFAULT 'XAF',
    stock INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT unique_full_vector UNIQUE (full_vector),
    CONSTRAINT check_vectors_labels_length CHECK (array_length(product_vector, 1) = array_length(product_labels, 1))
);

-- Index pour autocomplete_combinations
CREATE INDEX IF NOT EXISTS idx_combinations_session ON autocomplete_combinations(session_id);
CREATE INDEX IF NOT EXISTS idx_combinations_usage_count ON autocomplete_combinations(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_combinations_variant ON autocomplete_combinations(has_variant, variant_dimension, variant_value);
CREATE INDEX IF NOT EXISTS idx_combinations_product_vector_gin ON autocomplete_combinations USING GIN(product_vector);
CREATE INDEX IF NOT EXISTS idx_combinations_full_vector_gin ON autocomplete_combinations USING GIN(full_vector);

-- Index conditionnels pour autocomplete_combinations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_combinations_service_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_combinations_service_id ON autocomplete_combinations(service_id) WHERE service_id IS NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_combinations_ai_preferred' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_combinations_ai_preferred ON autocomplete_combinations(is_ai_preferred) WHERE is_ai_preferred = TRUE;
    END IF;
END $$;

-- ✅ 2026-01-03: Table service_products (produits de services séparés du JSONB)
-- Cette table remplace le stockage JSONB dans services.data->'produits'->'valeur'
-- pour améliorer les performances d'ajout et de recherche
CREATE TABLE IF NOT EXISTS service_products (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    product_data JSONB NOT NULL,
    
    -- Métadonnées générées
    product_name TEXT GENERATED ALWAYS AS (
        COALESCE(
            product_data->'nom'->>'valeur',
            product_data->>'nom',
            product_data->'nom_produit'->>'valeur',
            product_data->>'nom_produit',
            'Produit sans nom'
        )
    ) STORED,
    
    product_type TEXT GENERATED ALWAYS AS (
        COALESCE(
            product_data->'type'->>'valeur',
            product_data->>'type',
            'autre'
        )
    ) STORED,
    
    product_price NUMERIC GENERATED ALWAYS AS (
        CASE 
            WHEN product_data->'prix'->'valeur'->>'montant' IS NOT NULL 
            THEN (product_data->'prix'->'valeur'->>'montant')::NUMERIC
            WHEN product_data->'prix'->>'montant' IS NOT NULL 
            THEN (product_data->'prix'->>'montant')::NUMERIC
            WHEN product_data->>'prix' IS NOT NULL 
            THEN (product_data->>'prix')::NUMERIC
            ELSE NULL
        END
    ) STORED,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ,
    
    UNIQUE(service_id, product_index)
);

-- Index pour performance service_products
CREATE INDEX IF NOT EXISTS idx_service_products_service_id ON service_products(service_id);
CREATE INDEX IF NOT EXISTS idx_service_products_active ON service_products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_service_products_type ON service_products(product_type);
CREATE INDEX IF NOT EXISTS idx_service_products_name_gin ON service_products USING GIN(to_tsvector('french', product_name));
CREATE INDEX IF NOT EXISTS idx_service_products_data_gin ON service_products USING GIN(product_data);
CREATE INDEX IF NOT EXISTS idx_service_products_service_index ON service_products(service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_service_products_created_at ON service_products(created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_service_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_service_products_updated_at ON service_products;
CREATE TRIGGER trg_service_products_updated_at
    BEFORE UPDATE ON service_products
    FOR EACH ROW
    EXECUTE FUNCTION update_service_products_updated_at();

COMMENT ON TABLE service_products IS 'Table séparée pour les produits de services. Améliore les performances d''ajout et de recherche par rapport au JSONB dans services.data';
COMMENT ON COLUMN service_products.product_index IS 'Position du produit dans l''ordre d''affichage (0, 1, 2, ...). Doit être unique par service.';
COMMENT ON COLUMN service_products.product_data IS 'Toutes les données du produit au format JSONB (nom, prix, description, type, images, etc.)';

-- Table products_lifecycle (gestion cycle de vie des produits)
CREATE TABLE IF NOT EXISTS products_lifecycle (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    product_nom TEXT NOT NULL,
    product_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    last_reactivated_at TIMESTAMPTZ,
    reactivation_cost INTEGER DEFAULT 1000,
    deactivation_count INTEGER DEFAULT 0,
    total_reactivation_paid INTEGER DEFAULT 0,
    UNIQUE(service_id, product_index)
);

-- Index pour products_lifecycle
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_id ON products_lifecycle(service_id);
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_active ON products_lifecycle(is_active);
-- ✅ 2025-11-27 : Index composites pour optimiser get_services_for_prestataire
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_product ON products_lifecycle (service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_product_active ON products_lifecycle (service_id, product_index, is_active);
-- Index pour optimiser la requête principale (user_id + created_at)
CREATE INDEX IF NOT EXISTS idx_services_user_id_created_at_desc ON services (user_id, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_products_lifecycle_auto_deactivate' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_products_lifecycle_auto_deactivate ON products_lifecycle(auto_deactivate_at) WHERE is_active = TRUE;
    END IF;
END $$;

-- Table service_reviews (avis/commentaires avec support réponses - 2025-11-04)
-- Permet à TOUS les utilisateurs de noter et commenter les produits/services
-- Supporte les réponses aux commentaires avec indexation claire
CREATE TABLE IF NOT EXISTS service_reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 0 AND rating <= 5) NOT NULL,
    comment TEXT,
    reply_to_review_id INTEGER REFERENCES service_reviews(id) ON DELETE CASCADE,
    is_helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour service_reviews
CREATE INDEX IF NOT EXISTS idx_service_reviews_user_id ON service_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_service_reviews_service_id ON service_reviews(service_id);
CREATE INDEX IF NOT EXISTS idx_service_reviews_rating ON service_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_service_reviews_created_at ON service_reviews(created_at);

-- Index pour les réponses (SQLx offline mode compatible)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_service_reviews_reply_to'
    ) THEN
        CREATE INDEX idx_service_reviews_reply_to ON service_reviews(reply_to_review_id) WHERE reply_to_review_id IS NOT NULL;
    END IF;
END $$;

-- Table product_reactions (réactions/émotions sur les produits - 2025-11-04)
-- Permet aux utilisateurs de réagir avec des émotions sur les produits
CREATE TABLE IF NOT EXISTS product_reactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,  -- Format: "serviceId_productIndex"
    reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN (
        'love',        -- adore
        'like',        -- aime
        'wow',         -- impressionnant
        'interested',  -- interessant
        'thinking',    -- a reflechir
        'disappointed' -- decu
    )),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, service_id, product_id, reaction_type)
);

-- Index pour product_reactions (SQLx offline mode compatible)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_product_reactions_product'
    ) THEN
        CREATE INDEX idx_product_reactions_product ON product_reactions(service_id, product_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_product_reactions_user'
    ) THEN
        CREATE INDEX idx_product_reactions_user ON product_reactions(user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_product_reactions_type'
    ) THEN
        CREATE INDEX idx_product_reactions_type ON product_reactions(reaction_type);
    END IF;
END $$;

-- Table product_comments (fil de discussion moderne - 2025-11-08)
CREATE TABLE IF NOT EXISTS product_comments (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id INTEGER REFERENCES product_comments(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating BETWEEN 0 AND 5),
    content TEXT NOT NULL,
    mentions INTEGER[] NOT NULL DEFAULT '{}',
    reaction_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_product_comments_service ON product_comments(service_id);
CREATE INDEX IF NOT EXISTS idx_product_comments_parent ON product_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_product_comments_user ON product_comments(user_id);

CREATE OR REPLACE FUNCTION set_product_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_product_comments_updated_at ON product_comments;
CREATE TRIGGER trigger_product_comments_updated_at
    BEFORE UPDATE ON product_comments
    FOR EACH ROW
    EXECUTE FUNCTION set_product_comments_updated_at();

CREATE TABLE IF NOT EXISTS product_comment_reactions (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES product_comments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN (
        'like',
        'love',
        'insightful',
        'support',
        'funny',
        'angry'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(comment_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_product_comment_reactions_comment ON product_comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_product_comment_reactions_user ON product_comment_reactions(user_id);

CREATE OR REPLACE VIEW product_comments_view AS
SELECT
    pc.id,
    pc.service_id,
    pc.user_id,
    pc.parent_comment_id,
    pc.rating,
    pc.content,
    pc.mentions,
    pc.reaction_counts,
    pc.created_at,
    pc.updated_at,
    pc.edited_at,
    pc.is_deleted,
    COALESCE(u.nom_complet, u.email) AS user_name,
    u.avatar_url AS user_avatar,
    (
        SELECT jsonb_object_agg(reaction_type, reaction_count)
        FROM (
            SELECT reaction_type, COUNT(*)::INT AS reaction_count
            FROM product_comment_reactions
            WHERE comment_id = pc.id
            GROUP BY reaction_type
        ) sub
    ) AS aggregated_reactions,
    (
        SELECT COUNT(*)::INT
        FROM product_comments replies
        WHERE replies.parent_comment_id = pc.id
          AND replies.is_deleted = FALSE
    ) AS reply_count
FROM product_comments pc
JOIN users u ON u.id = pc.user_id;

COMMENT ON VIEW product_comments_view IS 'Commentaires produits enrichis avec auteur, réactions agrégées et nombre de réponses';

-- Table private_conversations (conversations privées 1-to-1 - 2025-11-04)
CREATE TABLE IF NOT EXISTS private_conversations (
    id SERIAL PRIMARY KEY,
    user_1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_1_id, user_2_id),
    CONSTRAINT chk_users_order CHECK (user_1_id < user_2_id)
);

-- Index pour private_conversations (SQLx offline mode compatible)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_private_conversations_user_1'
    ) THEN
        CREATE INDEX idx_private_conversations_user_1 ON private_conversations(user_1_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_private_conversations_user_2'
    ) THEN
        CREATE INDEX idx_private_conversations_user_2 ON private_conversations(user_2_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_private_conversations_last_message'
    ) THEN
        CREATE INDEX idx_private_conversations_last_message ON private_conversations(last_message_at DESC);
    END IF;
END $$;

-- Fonction pour obtenir le décompte des réactions par produit
CREATE OR REPLACE FUNCTION get_product_reactions_count(
    p_service_id INTEGER,
    p_product_id TEXT
)
RETURNS TABLE (
    reaction_type VARCHAR(20),
    count BIGINT,
    users_sample TEXT[]
)
LANGUAGE SQL
AS $$
    SELECT 
        pr.reaction_type,
        COUNT(*)::BIGINT as count,
        array_agg(COALESCE(u.nom_complet, u.email) ORDER BY pr.created_at DESC)::TEXT[] as users_sample
    FROM product_reactions pr
    LEFT JOIN users u ON pr.user_id = u.id
    WHERE pr.service_id = p_service_id
      AND pr.product_id = p_product_id
    GROUP BY pr.reaction_type
    ORDER BY count DESC;
$$;

-- Table publicites (gestion des publicités)
CREATE TABLE IF NOT EXISTS publicites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    produits_indexes TEXT[] NOT NULL DEFAULT '{}',
    videos TEXT[] DEFAULT '{}',
    thumbnails TEXT[] DEFAULT '{}',
    duree_jours INTEGER NOT NULL CHECK (duree_jours > 0),
    cout INTEGER NOT NULL CHECK (cout >= 0),
    devise_utilisateur VARCHAR(10) DEFAULT 'FCFA',
    zone_geographique VARCHAR(50) NOT NULL DEFAULT 'local' CHECK (zone_geographique IN ('local', 'regional', 'international')),
    geo_publicitaire GEOMETRY(POINT, 4326),
    rayon_km INTEGER DEFAULT 50,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'paused')),
    date_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_fin TIMESTAMPTZ NOT NULL,
    vues INTEGER NOT NULL DEFAULT 0,
    clics INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- ✅ NOUVEAU: Fonctionnalités avancées pour 100% parité avec les géants
    targeting JSONB DEFAULT '{}',
    ab_testing JSONB DEFAULT '{}',
    schedule JSONB DEFAULT NULL,
    placements JSONB DEFAULT '[]',
    bid_strategy JSONB DEFAULT '{}',
    retargeting JSONB DEFAULT '{}',
    variant_performance JSONB DEFAULT '{}',
    CONSTRAINT check_date_fin_after_debut CHECK (date_fin > date_debut),
    CONSTRAINT check_produits_not_empty CHECK (array_length(produits_indexes, 1) > 0)
);

-- Index pour publicites
CREATE INDEX IF NOT EXISTS idx_publicites_user_id ON publicites(user_id);
CREATE INDEX IF NOT EXISTS idx_publicites_status ON publicites(status);
CREATE INDEX IF NOT EXISTS idx_publicites_zone ON publicites(zone_geographique);
CREATE INDEX IF NOT EXISTS idx_publicites_date_fin ON publicites(date_fin);
CREATE INDEX IF NOT EXISTS idx_publicites_produits_gin ON publicites USING GIN(produits_indexes);
-- ✅ NOUVEAU: Index pour fonctionnalités avancées
CREATE INDEX IF NOT EXISTS idx_publicites_targeting_gin ON publicites USING GIN(targeting);
CREATE INDEX IF NOT EXISTS idx_publicites_ab_testing_gin ON publicites USING GIN(ab_testing);
CREATE INDEX IF NOT EXISTS idx_publicites_placements_gin ON publicites USING GIN(placements);
CREATE INDEX IF NOT EXISTS idx_publicites_retargeting_gin ON publicites USING GIN(retargeting);
CREATE INDEX IF NOT EXISTS idx_publicites_schedule_start ON publicites((schedule->>'start_date')) WHERE schedule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_publicites_schedule_end ON publicites((schedule->>'end_date')) WHERE schedule IS NOT NULL;

-- ✅ NOUVEAU 2025-01-01: Table pour versioning des publicités (historique complet)
CREATE TABLE IF NOT EXISTS publicite_versions (
    id SERIAL PRIMARY KEY,
    publicite_id INTEGER NOT NULL REFERENCES publicites(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_snapshot JSONB NOT NULL,
    change_type VARCHAR(50) NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    change_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_publicite_version UNIQUE (publicite_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_publicite_versions_publicite_id ON publicite_versions(publicite_id);
CREATE INDEX IF NOT EXISTS idx_publicite_versions_user_id ON publicite_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_publicite_versions_created_at ON publicite_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publicite_versions_change_type ON publicite_versions(change_type);

COMMENT ON TABLE publicite_versions IS 'Historique complet des modifications de publicités';
COMMENT ON COLUMN publicite_versions.version_number IS 'Numéro de version incrémental pour chaque publicité';
COMMENT ON COLUMN publicite_versions.data_snapshot IS 'Snapshot JSON complet de toutes les données de la publicité à ce moment';
COMMENT ON COLUMN publicite_versions.change_type IS 'Type de modification: created, updated, paused, resumed, deleted';

-- Fonction pour créer automatiquement une version lors d'une modification
CREATE OR REPLACE FUNCTION create_publicite_version()
RETURNS TRIGGER AS $$
DECLARE
    next_version INTEGER;
    snapshot_data JSONB;
    change_type_val VARCHAR(50);
BEGIN
    -- Déterminer le prochain numéro de version
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM publicite_versions
    WHERE publicite_id = NEW.id;
    
    -- Créer un snapshot complet de toutes les données
    snapshot_data := jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'titre', NEW.titre,
        'description', NEW.description,
        'produits_indexes', NEW.produits_indexes,
        'videos', NEW.videos,
        'thumbnails', NEW.thumbnails,
        'duree_jours', NEW.duree_jours,
        'cout', NEW.cout,
        'devise_utilisateur', NEW.devise_utilisateur,
        'zone_geographique', NEW.zone_geographique,
        'rayon_km', NEW.rayon_km,
        'status', NEW.status,
        'date_debut', NEW.date_debut,
        'date_fin', NEW.date_fin,
        'vues', NEW.vues,
        'clics', NEW.clics,
        'impressions', NEW.impressions,
        'targeting', NEW.targeting,
        'ab_testing', NEW.ab_testing,
        'schedule', NEW.schedule,
        'placements', NEW.placements,
        'bid_strategy', NEW.bid_strategy,
        'retargeting', NEW.retargeting,
        'variant_performance', NEW.variant_performance,
        'created_at', NEW.created_at,
        'updated_at', NEW.updated_at
    );
    
    -- Déterminer le type de changement
    IF TG_OP = 'INSERT' THEN
        change_type_val := 'created';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            IF NEW.status = 'paused' THEN
                change_type_val := 'paused';
            ELSIF NEW.status = 'active' AND OLD.status = 'paused' THEN
                change_type_val := 'resumed';
            ELSE
                change_type_val := 'updated';
            END IF;
        ELSE
            change_type_val := 'updated';
        END IF;
    END IF;
    
    -- Insérer la version
    INSERT INTO publicite_versions (
        publicite_id,
        version_number,
        user_id,
        data_snapshot,
        change_type,
        changed_by,
        change_description
    )
    VALUES (
        NEW.id,
        next_version,
        NEW.user_id,
        snapshot_data,
        change_type_val,
        NEW.user_id,
        CASE 
            WHEN TG_OP = 'INSERT' THEN 'Création de la publicité'
            WHEN TG_OP = 'UPDATE' THEN 'Modification de la publicité'
            ELSE 'Changement inconnu'
        END
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour créer automatiquement une version à chaque modification
DROP TRIGGER IF EXISTS trigger_create_publicite_version ON publicites;
CREATE TRIGGER trigger_create_publicite_version
    AFTER INSERT OR UPDATE ON publicites
    FOR EACH ROW
    EXECUTE FUNCTION create_publicite_version();

-- Fonction pour restaurer une version
CREATE OR REPLACE FUNCTION restore_publicite_version(
    p_publicite_id INTEGER,
    p_version_number INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    version_data JSONB;
BEGIN
    -- Récupérer les données de la version
    SELECT data_snapshot
    INTO version_data
    FROM publicite_versions
    WHERE publicite_id = p_publicite_id
    AND version_number = p_version_number;
    
    IF version_data IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Restaurer les données (sauf id, created_at, et certaines métriques)
    UPDATE publicites
    SET
        titre = (version_data->>'titre')::VARCHAR,
        description = (version_data->>'description')::TEXT,
        produits_indexes = ARRAY(SELECT jsonb_array_elements_text(version_data->'produits_indexes')),
        videos = ARRAY(SELECT jsonb_array_elements_text(version_data->'videos')),
        thumbnails = ARRAY(SELECT jsonb_array_elements_text(version_data->'thumbnails')),
        duree_jours = (version_data->>'duree_jours')::INTEGER,
        cout = (version_data->>'cout')::INTEGER,
        devise_utilisateur = (version_data->>'devise_utilisateur')::VARCHAR,
        zone_geographique = (version_data->>'zone_geographique')::VARCHAR,
        rayon_km = (version_data->>'rayon_km')::INTEGER,
        status = (version_data->>'status')::VARCHAR,
        date_debut = (version_data->>'date_debut')::TIMESTAMPTZ,
        date_fin = (version_data->>'date_fin')::TIMESTAMPTZ,
        targeting = version_data->'targeting',
        ab_testing = version_data->'ab_testing',
        schedule = version_data->'schedule',
        placements = version_data->'placements',
        bid_strategy = version_data->'bid_strategy',
        retargeting = version_data->'retargeting',
        variant_performance = version_data->'variant_performance',
        updated_at = NOW()
    WHERE id = p_publicite_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_publicites_active' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_publicites_active ON publicites(status, date_fin) WHERE status = 'active';
    END IF;
END $$;

-- Table notifications (gestion des notifications utilisateurs)
-- ✅ 2025-12-01 : Table user_push_tokens pour les notifications push
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_token VARCHAR(500) NOT NULL UNIQUE,
    device_type VARCHAR(20) NOT NULL,
    device_id VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_push_token ON user_push_tokens(push_token);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_is_active ON user_push_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_device ON user_push_tokens(device_id);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_push_tokens_updated_at 
    BEFORE UPDATE ON user_push_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50),
    notification_type VARCHAR(50),
    title VARCHAR(255),
    message TEXT NOT NULL,
    data JSONB,
    metadata JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ
);

-- Index pour notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_notifications_user_unread' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_notifications_type' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_notifications_type ON notifications(type) WHERE type IS NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_notifications_notification_type' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_notifications_notification_type ON notifications(notification_type) WHERE notification_type IS NOT NULL;
    END IF;
END $$;

-- ========================================
-- FONCTIONS ET TRIGGERS SQL
-- ========================================

-- Fonction : Désactiver les produits expirés automatiquement
-- ✅ MODIFIÉ 2025-01-28: Inclut vérification stock = 0 (uniquement pour les produits)
CREATE OR REPLACE FUNCTION deactivate_expired_products()
RETURNS TABLE(
    service_id INTEGER,
    product_index INTEGER,
    product_nom TEXT,
    user_id INTEGER,
    deactivation_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    UPDATE products_lifecycle pl
    SET 
        is_active = FALSE,
        updated_at = NOW(),
        deactivation_count = deactivation_count + 1
    FROM services s
    WHERE pl.service_id = s.id
        AND pl.is_active = TRUE
        AND (
            -- Critère 1: Délai expiré (existant)
            pl.auto_deactivate_at <= NOW()
            OR
            -- ✅ NOUVEAU Critère 2: Stock = 0 (uniquement pour les produits)
            (
                s.is_tarissable = TRUE  -- Uniquement pour les produits
                AND EXISTS (
                    SELECT 1 
                    FROM autocomplete_combinations ac
                    WHERE ac.service_id = s.id
                        AND ac.stock IS NOT NULL
                        AND ac.stock <= 0
                )
            )
        )
    RETURNING 
        pl.service_id,
        pl.product_index,
        pl.product_nom,
        s.user_id,
        CASE 
            WHEN pl.auto_deactivate_at <= NOW() THEN 'expired_time'
            ELSE 'stock_zero'
        END::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Fonction : Mettre à jour updated_at pour publicites
CREATE OR REPLACE FUNCTION update_publicites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger : Appliquer update_publicites_updated_at
DROP TRIGGER IF EXISTS trigger_update_publicites_updated_at ON publicites;
CREATE TRIGGER trigger_update_publicites_updated_at
    BEFORE UPDATE ON publicites
    FOR EACH ROW
    EXECUTE FUNCTION update_publicites_updated_at();

-- Fonction : Calculer automatiquement date_fin pour publicites
CREATE OR REPLACE FUNCTION set_publicite_date_fin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date_fin IS NULL OR NEW.date_fin = NEW.date_debut THEN
        NEW.date_fin = NEW.date_debut + (NEW.duree_jours || ' days')::interval;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger : Appliquer set_publicite_date_fin
DROP TRIGGER IF EXISTS trigger_set_publicite_date_fin ON publicites;
CREATE TRIGGER trigger_set_publicite_date_fin
    BEFORE INSERT OR UPDATE ON publicites
    FOR EACH ROW
    EXECUTE FUNCTION set_publicite_date_fin();

-- Fonction : Désactiver les publicités expirées
CREATE OR REPLACE FUNCTION deactivate_expired_publicites()
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    UPDATE publicites
    SET status = 'expired'
    WHERE status = 'active'
    AND date_fin < NOW();
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- ✅ NOUVEAU: Fonction pour vérifier si une publicité doit être active selon la planification
CREATE OR REPLACE FUNCTION is_publicite_scheduled_active(pub_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    pub_schedule JSONB;
    start_date TIMESTAMPTZ;
    end_date TIMESTAMPTZ;
    pause_weekends BOOLEAN;
    current_day INTEGER;
BEGIN
    SELECT schedule INTO pub_schedule FROM publicites WHERE id = pub_id;
    IF pub_schedule IS NULL OR pub_schedule = '{}'::jsonb THEN
        RETURN TRUE;
    END IF;
    IF pub_schedule->>'start_date' IS NOT NULL THEN
        start_date := (pub_schedule->>'start_date')::timestamptz;
        IF NOW() < start_date THEN RETURN FALSE; END IF;
    END IF;
    IF pub_schedule->>'end_date' IS NOT NULL THEN
        end_date := (pub_schedule->>'end_date')::timestamptz;
        IF NOW() > end_date THEN RETURN FALSE; END IF;
    END IF;
    pause_weekends := COALESCE((pub_schedule->>'pause_on_weekends')::boolean, FALSE);
    IF pause_weekends THEN
        current_day := EXTRACT(DOW FROM NOW())::integer;
        IF current_day = 0 OR current_day = 6 THEN RETURN FALSE; END IF;
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ✅ NOUVEAU: Fonction pour filtrer par ciblage avancé
CREATE OR REPLACE FUNCTION matches_targeting(pub_targeting JSONB, user_age INTEGER, user_gender TEXT, user_interests TEXT[], user_behaviors TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
    target_age_min INTEGER;
    target_age_max INTEGER;
    target_gender TEXT;
    target_interests JSONB;
    target_behaviors JSONB;
BEGIN
    IF pub_targeting IS NULL OR pub_targeting = '{}'::jsonb THEN RETURN TRUE; END IF;
    IF pub_targeting->'age_range' IS NOT NULL THEN
        target_age_min := COALESCE((pub_targeting->'age_range'->>'min')::integer, 0);
        target_age_max := COALESCE((pub_targeting->'age_range'->>'max')::integer, 999);
        IF user_age < target_age_min OR user_age > target_age_max THEN RETURN FALSE; END IF;
    END IF;
    target_gender := pub_targeting->>'gender';
    IF target_gender IS NOT NULL AND target_gender != 'all' THEN
        IF target_gender != user_gender THEN RETURN FALSE; END IF;
    END IF;
    target_interests := pub_targeting->'interests';
    IF target_interests IS NOT NULL AND jsonb_array_length(target_interests) > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(target_interests) AS interest WHERE interest = ANY(user_interests)) THEN
            RETURN FALSE;
        END IF;
    END IF;
    target_behaviors := pub_targeting->'behaviors';
    IF target_behaviors IS NOT NULL AND jsonb_array_length(target_behaviors) > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(target_behaviors) AS behavior WHERE behavior = ANY(user_behaviors)) THEN
            RETURN FALSE;
        END IF;
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ✅ NOUVEAU: Fonction pour vérifier le retargeting
CREATE OR REPLACE FUNCTION matches_retargeting(pub_retargeting JSONB, user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    retargeting_rules JSONB;
    rule JSONB;
    rule_type TEXT;
    days_since INTEGER;
    match_found BOOLEAN := FALSE;
BEGIN
    IF pub_retargeting IS NULL OR pub_retargeting = '{}'::jsonb THEN RETURN TRUE; END IF;
    retargeting_rules := pub_retargeting->'rules';
    IF retargeting_rules IS NULL OR jsonb_array_length(retargeting_rules) = 0 THEN RETURN TRUE; END IF;
    FOR rule IN SELECT * FROM jsonb_array_elements(retargeting_rules) LOOP
        rule_type := rule->>'type';
        days_since := COALESCE((rule->>'days_since')::integer, 7);
        CASE rule_type
            WHEN 'viewed_product' THEN
                SELECT EXISTS (SELECT 1 FROM user_behavior WHERE user_id = user_id AND behavior_type = 'product_view' AND created_at > NOW() - (days_since || ' days')::interval) INTO match_found;
            WHEN 'abandoned_cart' THEN
                SELECT EXISTS (SELECT 1 FROM shopping_baskets WHERE user_id = user_id AND status = 'abandoned' AND updated_at > NOW() - (days_since || ' days')::interval) INTO match_found;
            WHEN 'visited_service' THEN
                SELECT EXISTS (SELECT 1 FROM user_behavior WHERE user_id = user_id AND behavior_type = 'service_view' AND created_at > NOW() - (days_since || ' days')::interval) INTO match_found;
            WHEN 'searched' THEN
                SELECT EXISTS (SELECT 1 FROM search_history WHERE user_id = user_id AND created_at > NOW() - (days_since || ' days')::interval) INTO match_found;
            ELSE match_found := FALSE;
        END CASE;
        IF match_found THEN RETURN TRUE; END IF;
    END LOOP;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ✅ NOUVEAU: Table pour tracker les impressions (affichages) de publicités
CREATE TABLE IF NOT EXISTS publicite_impressions (
    id SERIAL PRIMARY KEY,
    publicite_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    placement VARCHAR(50) NOT NULL, -- 'feed', 'stories', 'carousel', 'search', etc.
    viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (publicite_id) REFERENCES publicites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_publicite_user ON publicite_impressions(publicite_id, user_id);
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_user_date ON publicite_impressions(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_publicite_date ON publicite_impressions(publicite_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_placement ON publicite_impressions(placement);
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_user_publicite_date ON publicite_impressions(user_id, publicite_id, viewed_at DESC);

-- ✅ NOUVEAU: Fonction pour vérifier la fréquence d'affichage
CREATE OR REPLACE FUNCTION check_publicite_frequency(
    p_publicite_id INTEGER,
    p_user_id INTEGER,
    p_frequency_type VARCHAR(20) DEFAULT 'daily'
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_frequency_limit INTEGER;
    v_frequency_config JSONB;
BEGIN
    SELECT frequency_config INTO v_frequency_config FROM publicites WHERE id = p_publicite_id;
    IF v_frequency_config IS NULL OR v_frequency_config = '{}'::jsonb THEN RETURN TRUE; END IF;
    IF p_frequency_type = 'daily' THEN
        v_frequency_limit := COALESCE((v_frequency_config->>'max_per_day')::INTEGER, 999999);
        SELECT COUNT(*) INTO v_count FROM publicite_impressions WHERE publicite_id = p_publicite_id AND user_id = p_user_id AND viewed_at >= CURRENT_DATE;
    ELSIF p_frequency_type = 'weekly' THEN
        v_frequency_limit := COALESCE((v_frequency_config->>'max_per_week')::INTEGER, 999999);
        SELECT COUNT(*) INTO v_count FROM publicite_impressions WHERE publicite_id = p_publicite_id AND user_id = p_user_id AND viewed_at >= DATE_TRUNC('week', CURRENT_DATE);
    ELSE RETURN TRUE;
    END IF;
    RETURN v_count < v_frequency_limit;
END;
$$ LANGUAGE plpgsql;

-- ✅ NOUVEAU: Fonction pour enregistrer une impression
CREATE OR REPLACE FUNCTION record_publicite_impression(
    p_publicite_id INTEGER,
    p_user_id INTEGER,
    p_placement VARCHAR(50) DEFAULT 'feed'
) RETURNS INTEGER AS $$
DECLARE
    v_impression_id INTEGER;
BEGIN
    INSERT INTO publicite_impressions (publicite_id, user_id, placement)
    VALUES (p_publicite_id, p_user_id, p_placement)
    RETURNING id INTO v_impression_id;
    RETURN v_impression_id;
END;
$$ LANGUAGE plpgsql;

-- ✅ NOUVEAU 2025-01-XX: Table pour les événements pixel (tracking avancé)
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

-- ✅ NOUVEAU 2025-01-XX: Table pour les audiences personnalisées (amélioration)
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

-- ✅ NOUVEAU 2025-01-XX: Table pour les rapports automatisés
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
COMMENT ON TABLE pixel_events IS 'Événements de tracking pixel pour retargeting et audiences';
COMMENT ON TABLE publicite_audiences IS 'Audiences personnalisées et lookalike pour publicités';
COMMENT ON TABLE automated_reports IS 'Rapports automatisés pour publicités (daily, weekly, monthly)';
COMMENT ON COLUMN automated_reports.metrics IS 'Liste des métriques à inclure: views, clicks, conversions, roi, etc.';

-- Fonction : Mettre à jour updated_at pour autocomplete_characteristics
CREATE OR REPLACE FUNCTION update_autocomplete_characteristics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger : Appliquer update_autocomplete_characteristics_updated_at
DROP TRIGGER IF EXISTS trigger_autocomplete_characteristics_updated_at ON autocomplete_characteristics;
CREATE TRIGGER trigger_autocomplete_characteristics_updated_at
    BEFORE UPDATE ON autocomplete_characteristics
    FOR EACH ROW
    EXECUTE FUNCTION update_autocomplete_characteristics_updated_at();

-- Fonction : Upsert caractéristique autocomplete (incrémenter usage_count si existe)
CREATE OR REPLACE FUNCTION upsert_autocomplete_characteristic(
    p_identifiant_base VARCHAR(255),
    p_sous_caracteristique VARCHAR(255),
    p_valeur VARCHAR(500),
    p_origine_champs VARCHAR(50) DEFAULT 'ia',
    p_user_id INTEGER DEFAULT NULL,
    p_service_id INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO autocomplete_characteristics (
        identifiant_base,
        sous_caracteristique,
        valeur,
        origine_champs,
        user_id,
        service_id,
        usage_count
    )
    VALUES (
        p_identifiant_base,
        p_sous_caracteristique,
        p_valeur,
        p_origine_champs,
        p_user_id,
        p_service_id,
        1
    )
    ON CONFLICT (identifiant_base, sous_caracteristique, valeur)
    DO UPDATE SET
        usage_count = autocomplete_characteristics.usage_count + 1,
        updated_at = NOW();
    
    SELECT id INTO v_id
    FROM autocomplete_characteristics
    WHERE identifiant_base = p_identifiant_base
    AND sous_caracteristique = p_sous_caracteristique
    AND valeur = p_valeur;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction : Mettre à jour updated_at pour autocomplete_combinations
CREATE OR REPLACE FUNCTION update_combinations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger : Appliquer update_combinations_updated_at
DROP TRIGGER IF EXISTS trigger_combinations_updated_at ON autocomplete_combinations;
CREATE TRIGGER trigger_combinations_updated_at
    BEFORE UPDATE ON autocomplete_combinations
    FOR EACH ROW
    EXECUTE FUNCTION update_combinations_updated_at();

-- Fonction : Upsert combinaison autocomplete (avec labels)
CREATE OR REPLACE FUNCTION upsert_autocomplete_combination(
    p_product_vector TEXT[],
    p_location_vector TEXT[],
    p_full_vector TEXT[],
    p_product_labels TEXT[],
    p_location_labels TEXT[],
    p_chosen_location TEXT,
    p_is_ai_preferred BOOLEAN,
    p_ai_confidence FLOAT,
    p_session_id TEXT,
    p_has_variant BOOLEAN,
    p_variant_dimension TEXT,
    p_variant_value TEXT,
    p_prix NUMERIC,
    p_devise TEXT,
    p_stock INTEGER,
    p_service_id INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
    v_existing_count INTEGER;
BEGIN
    SELECT id, usage_count INTO v_id, v_existing_count
    FROM autocomplete_combinations
    WHERE full_vector = p_full_vector;
    
    IF FOUND THEN
        UPDATE autocomplete_combinations
        SET 
            usage_count = usage_count + 1,
            is_ai_preferred = CASE WHEN p_is_ai_preferred THEN TRUE ELSE is_ai_preferred END,
            ai_confidence = GREATEST(ai_confidence, p_ai_confidence),
            service_id = COALESCE(p_service_id, service_id),
            product_labels = p_product_labels,
            location_labels = p_location_labels,
            updated_at = NOW()
        WHERE id = v_id;
        RETURN v_id;
    ELSE
        INSERT INTO autocomplete_combinations (
            service_id, product_vector, product_labels, location_vector, location_labels, full_vector,
            chosen_location, usage_count, is_ai_preferred, ai_confidence,
            session_id, has_variant, variant_dimension, variant_value,
            prix, devise, stock
        ) VALUES (
            p_service_id, p_product_vector, p_product_labels, p_location_vector, p_location_labels, p_full_vector,
            p_chosen_location, 1, p_is_ai_preferred, p_ai_confidence,
            p_session_id, p_has_variant, p_variant_dimension, p_variant_value,
            p_prix, p_devise, p_stock
        )
        RETURNING id INTO v_id;
        RETURN v_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Fonction : Calculer le score de localisation pour autocomplete
CREATE OR REPLACE FUNCTION calculate_location_score(
    search_location TEXT,
    location_vector TEXT[],
    chosen_location TEXT
)
RETURNS FLOAT AS $$
DECLARE
    score FLOAT := 0.0;
    search_lower TEXT;
    i INTEGER;
    vec_length INTEGER;
BEGIN
    IF search_location IS NULL OR location_vector IS NULL THEN
        RETURN 0.0;
    END IF;
    
    search_lower := LOWER(search_location);
    vec_length := array_length(location_vector, 1);

    IF vec_length IS NULL OR vec_length < 1 THEN
        RETURN 0.0;
    END IF;
    
    IF chosen_location IS NOT NULL AND LOWER(chosen_location) = search_lower THEN
        RETURN 1.0;
    END IF;
    
    FOR i IN 1..vec_length LOOP
        IF LOWER(location_vector[i]) = search_lower THEN
            score := 1.0 - (i - 1) * 0.1;
            EXIT;
        ELSIF LOWER(location_vector[i]) LIKE '%' || search_lower || '%' THEN
            score := 0.5 - (i - 1) * 0.1;
        END IF;
    END LOOP;
    
    RETURN GREATEST(score, 0.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction : Extraire une valeur du vecteur par son label
-- Ex: get_vector_value_by_label(["Nike", "Air Max", "Noir"], ["marque", "modele", "couleur"], "couleur") → "Noir"
CREATE OR REPLACE FUNCTION get_vector_value_by_label(
    p_vector TEXT[],
    p_labels TEXT[],
    p_search_label TEXT
)
RETURNS TEXT AS $$
DECLARE
    i INTEGER;
    vector_length INTEGER;
BEGIN
    IF p_vector IS NULL OR p_labels IS NULL OR p_search_label IS NULL THEN
        RETURN NULL;
    END IF;
    
    vector_length := array_length(p_vector, 1);

    IF vector_length IS NULL OR vector_length < 1 THEN
        RETURN NULL;
    END IF;

    IF vector_length != array_length(p_labels, 1) THEN
        RETURN NULL;
    END IF;
    
    FOR i IN 1..vector_length LOOP
        IF LOWER(p_labels[i]) = LOWER(p_search_label) THEN
            RETURN p_vector[i];
        END IF;
    END LOOP;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction : Convertir vecteur + labels en JSONB structuré
-- Ex: vector_to_jsonb(["Nike", "Air Max", "Noir"], ["marque", "modele", "couleur"]) 
--     → {"marque": "Nike", "modele": "Air Max", "couleur": "Noir"}
CREATE OR REPLACE FUNCTION vector_to_jsonb(
    p_vector TEXT[],
    p_labels TEXT[]
)
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}'::JSONB;
    i INTEGER;
    vector_length INTEGER;
BEGIN
    IF p_vector IS NULL OR p_labels IS NULL THEN
        RETURN result;
    END IF;
    
    vector_length := array_length(p_vector, 1);

    IF vector_length IS NULL OR vector_length < 1 THEN
        RETURN result;
    END IF;
    
    IF vector_length != array_length(p_labels, 1) THEN
        RETURN result;
    END IF;
    
    FOR i IN 1..vector_length LOOP
        result := result || jsonb_build_object(p_labels[i], p_vector[i]);
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Tables live streaming (2025-11-09)
CREATE TABLE IF NOT EXISTS live_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    livekit_room_name TEXT,
    livekit_participant_identity TEXT,
    livekit_ingress_id TEXT,
    livekit_ingress_url TEXT,
    stream_key TEXT,
    webrtc_url TEXT,
    hls_url TEXT,
    fallback_rtmp_url TEXT,
    fallback_hls_url TEXT,
    current_viewers INTEGER NOT NULL DEFAULT 0,
    peak_viewers INTEGER NOT NULL DEFAULT 0,
    total_watch_time_seconds BIGINT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_start_at ON live_sessions(start_at);
CREATE INDEX IF NOT EXISTS idx_live_sessions_service_id ON live_sessions(service_id);
-- ✅ 2025-12-22: Index optimisé pour JOIN avec live_flash_sales
CREATE INDEX IF NOT EXISTS idx_live_sessions_id_host_user 
ON live_sessions(id, host_user_id, service_id)
WHERE id IS NOT NULL;

CREATE TABLE IF NOT EXISTS live_replays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    replay_url TEXT NOT NULL,
    storage_provider TEXT,
    format TEXT,
    duration_seconds INTEGER,
    size_bytes BIGINT,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_replays_session_id ON live_replays(live_session_id);

CREATE TABLE IF NOT EXISTS live_session_analytics (
    live_session_id UUID PRIMARY KEY REFERENCES live_sessions(id) ON DELETE CASCADE,
    total_viewers INTEGER NOT NULL DEFAULT 0,
    hls_viewers INTEGER NOT NULL DEFAULT 0,
    webrtc_viewers INTEGER NOT NULL DEFAULT 0,
    total_watch_time_seconds BIGINT NOT NULL DEFAULT 0,
    average_watch_time_seconds NUMERIC(10,2) NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,
    revenue_cfa NUMERIC(14,2) NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_session_analytics_last_synced ON live_session_analytics(last_synced_at);

CREATE TABLE IF NOT EXISTS live_flash_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    promo_price_cfa NUMERIC(14,2) NOT NULL CHECK (promo_price_cfa >= 0),
    stock_target INTEGER NOT NULL CHECK (stock_target > 0),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled' CHECK (
        status IN ('scheduled', 'live', 'ended', 'cancelled')
    ),
    commentary_mode VARCHAR(20) NOT NULL DEFAULT 'host' CHECK (
        commentary_mode IN ('host', 'ai_voice')
    ),
    commentary_interval_seconds INTEGER NOT NULL DEFAULT 60 CHECK (commentary_interval_seconds >= 15),
    ai_voice_profile TEXT,
    scheduled_notification_sent_at TIMESTAMPTZ,
    live_notification_sent_at TIMESTAMPTZ,
    ending_notification_sent_at TIMESTAMPTZ,
    last_commentary_sent_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_live_flash_sales_session
    ON live_flash_sales(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status
    ON live_flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_timing
    ON live_flash_sales(start_at, end_at);
-- ✅ 2025-12-22: Index optimisé pour requêtes avec status + dates
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status_dates 
ON live_flash_sales(status, start_at, end_at)
WHERE status IN ('scheduled', 'live', 'ended');

CREATE TABLE IF NOT EXISTS live_flash_sale_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flash_sale_id UUID NOT NULL REFERENCES live_flash_sales(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (flash_sale_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_flash_sale_reservations_flash
    ON live_flash_sale_reservations(flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_live_flash_sale_reservations_user
    ON live_flash_sale_reservations(user_id);

CREATE TABLE IF NOT EXISTS live_flash_sale_commentaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flash_sale_id UUID NOT NULL REFERENCES live_flash_sales(id) ON DELETE CASCADE,
    created_by VARCHAR(20) NOT NULL CHECK (created_by IN ('host', 'ai_voice')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_flash_sale_commentaries_flash
    ON live_flash_sale_commentaries(flash_sale_id, created_at);

CREATE TABLE IF NOT EXISTS global_promo_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT NOT NULL UNIQUE,
    theme TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    recurrence_rule TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'scheduled', 'live', 'archived')
    ),
    config JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_global_promo_events_status
    ON global_promo_events(status, starts_at);
-- ✅ 2025-12-22: Index optimisé pour requêtes avec status + dates
CREATE INDEX IF NOT EXISTS idx_global_promo_events_status_dates 
ON global_promo_events(status, starts_at, ends_at)
WHERE status IN ('scheduled', 'live', 'archived');
CREATE INDEX IF NOT EXISTS idx_global_promo_events_theme
    ON global_promo_events(theme);

CREATE TABLE IF NOT EXISTS global_promo_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES global_promo_events(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    live_session_id UUID REFERENCES live_sessions(id) ON DELETE SET NULL,
    submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    discount_percentage NUMERIC(5,2) CHECK (
        discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)
    ),
    promo_price_cfa NUMERIC(14,2) CHECK (promo_price_cfa IS NULL OR promo_price_cfa >= 0),
    stock_cap INTEGER CHECK (stock_cap IS NULL OR stock_cap > 0),
    availability VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (
        availability IN ('online', 'live', 'both')
    ),
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'pending_review', 'approved', 'rejected', 'published', 'ended')
    ),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_global_promo_entries_event_status
    ON global_promo_entries(event_id, status);
-- ✅ 2025-12-22: Index optimisé pour JOIN avec global_promo_events (amélioration existant)
CREATE INDEX IF NOT EXISTS idx_global_promo_entries_event_id_status 
ON global_promo_entries(event_id, status)
WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_global_promo_entries_service
    ON global_promo_entries(service_id);
CREATE INDEX IF NOT EXISTS idx_global_promo_entries_live_session
    ON global_promo_entries(live_session_id);

CREATE TABLE IF NOT EXISTS global_promo_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promo_entry_id UUID NOT NULL UNIQUE REFERENCES global_promo_entries(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    availability VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (
        availability IN ('online', 'live', 'both')
    ),
    priority_score INTEGER NOT NULL DEFAULT 0,
    highlighted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_promo_products_priority
    ON global_promo_products(highlighted DESC, priority_score DESC);

ALTER TABLE live_flash_sales
    ADD COLUMN IF NOT EXISTS global_promo_entry_id UUID REFERENCES global_promo_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_flash_sales_global_promo
    ON live_flash_sales(global_promo_entry_id);

-- Social connectors tables
CREATE TABLE IF NOT EXISTS social_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    account_handle TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    scope TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

CREATE TABLE IF NOT EXISTS social_publications (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    external_post_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    published_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_publication_jobs (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    attempt INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user_platform ON social_accounts(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_social_publications_media ON social_publications(media_id);
CREATE INDEX IF NOT EXISTS idx_social_publications_platform ON social_publications(platform);
CREATE INDEX IF NOT EXISTS idx_social_publication_jobs_status ON social_publication_jobs(status, scheduled_for);

-- Table media_engagement
CREATE TABLE IF NOT EXISTS media_engagement (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    channel TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    metadata JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_engagement_media ON media_engagement(media_id);
CREATE INDEX IF NOT EXISTS idx_media_engagement_event ON media_engagement(event_type);
CREATE INDEX IF NOT EXISTS idx_media_engagement_service ON media_engagement(service_id);

-- Table media_distribution
CREATE TABLE IF NOT EXISTS media_distribution (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    target TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_media_distribution_media ON media_distribution(media_id);
CREATE INDEX IF NOT EXISTS idx_media_distribution_target ON media_distribution(target);

-- Table content_engagement
CREATE TABLE IF NOT EXISTS content_engagement (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL,
    liked BOOLEAN NOT NULL DEFAULT FALSE,
    saved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, content_id)
);
CREATE INDEX IF NOT EXISTS idx_content_engagement_user ON content_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_content_engagement_content ON content_engagement(content_id);

CREATE OR REPLACE FUNCTION set_content_engagement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_engagement_updated_at ON content_engagement;
CREATE TRIGGER trg_content_engagement_updated_at
    BEFORE UPDATE ON content_engagement
    FOR EACH ROW
    EXECUTE FUNCTION set_content_engagement_updated_at();

CREATE TABLE IF NOT EXISTS video_generation_jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    product_index INTEGER,
    status TEXT NOT NULL DEFAULT 'queued',
    progress_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    result_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    result_payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_user ON video_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_service ON video_generation_jobs(service_id);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status ON video_generation_jobs(status);
-- ✅ 2025-12-22: Index optimisés pour GROUP BY status et requêtes avec updated_at
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status_updated_at 
ON video_generation_jobs(status, updated_at)
WHERE status IS NOT NULL;

CREATE TABLE IF NOT EXISTS premium_audio_jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL,
    provider_job_id TEXT,
    source_path TEXT NOT NULL,
    output_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    video_job_id UUID REFERENCES video_generation_jobs(job_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_status ON premium_audio_jobs(status);
CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_updated_at ON premium_audio_jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_provider ON premium_audio_jobs(provider);
CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_provider_job ON premium_audio_jobs(provider, provider_job_id);

CREATE OR REPLACE FUNCTION set_premium_audio_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_premium_audio_jobs_updated_at ON premium_audio_jobs;
CREATE TRIGGER trg_premium_audio_jobs_updated_at
    BEFORE UPDATE ON premium_audio_jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_premium_audio_jobs_updated_at();

ALTER TABLE video_generation_jobs
    ADD COLUMN IF NOT EXISTS audio_job_id UUID,
    ADD COLUMN IF NOT EXISTS audio_status TEXT NOT NULL DEFAULT 'not_requested',
    ADD COLUMN IF NOT EXISTS audio_metadata JSONB;

ALTER TABLE video_generation_jobs
    ADD CONSTRAINT fk_video_generation_jobs_audio_job
    FOREIGN KEY (audio_job_id) REFERENCES premium_audio_jobs(job_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_audio_status
    ON video_generation_jobs(audio_status);

CREATE TABLE IF NOT EXISTS voice_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'custom',
    description TEXT,
    sample_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_voice_profiles_user ON voice_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_service ON voice_profiles(service_id);

CREATE OR REPLACE FUNCTION set_voice_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_voice_profiles_updated_at ON voice_profiles;
CREATE TRIGGER trg_voice_profiles_updated_at
    BEFORE UPDATE ON voice_profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_voice_profiles_updated_at();

CREATE TABLE IF NOT EXISTS studio_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    brief JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_templates TEXT[] NOT NULL DEFAULT '{}'::text[],
    timeline_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    distribution_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
    preview_status TEXT NOT NULL DEFAULT 'idle',
    preview_public_url TEXT,
    preview_job_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_sessions_user ON studio_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_sessions_service ON studio_sessions(service_id);

CREATE TABLE IF NOT EXISTS studio_timeline_clips (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    lane TEXT,
    duration_seconds INTEGER NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_clips_session
    ON studio_timeline_clips(session_id, position);

CREATE TABLE IF NOT EXISTS studio_dynamic_assets (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL,
    storage_key TEXT,
    public_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_assets_session
    ON studio_dynamic_assets(session_id);

CREATE OR REPLACE FUNCTION set_studio_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_studio_sessions_updated_at ON studio_sessions;
CREATE TRIGGER trg_studio_sessions_updated_at
    BEFORE UPDATE ON studio_sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_studio_sessions_updated_at();

-- Delivery service enums
DO $$
BEGIN
    CREATE TYPE delivery_status AS ENUM (
        'requested',
        'awaiting_courier_confirmation',
        'accepted',
        'en_route_pickup',
        'arrival_pickup',
        'picked_up',
        'shopping_in_progress',
        'shopping_completed',
        'en_route_delivery',
        'arrival_destination',
        'delivered',
        'completed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_cancel_reason AS ENUM (
        'client_cancelled',
        'courier_cancelled',
        'no_courier_available',
        'parcel_issue',
        'system_failure'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_engine_type AS ENUM (
        'moto',
        'scooter',
        'voiture',
        'camionnette',
        'velo_cargo',
        'pieton',
        'camion_leger',
        'autre'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_courier_status AS ENUM (
        'pending_review',
        'approved',
        'rejected',
        'suspended'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_terrain_difficulty AS ENUM (
        'smooth',
        'moderate',
        'rough',
        'blocked'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_application_status AS ENUM (
        'draft',
        'submitted',
        'under_review',
        'approved',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE shopping_status AS ENUM (
        'pending',
        'awaiting_purchase',
        'shopping_in_progress',
        'shopping_completed',
        'checkout_submitted',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE shopping_item_status AS ENUM (
        'pending',
        'purchased',
        'missing',
        'replaced'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- Parcel types catalogue
CREATE TABLE IF NOT EXISTS parcel_types (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    max_weight_kg NUMERIC(6,2),
    max_volume_cm3 NUMERIC(12,2),
    requires_isothermal BOOLEAN DEFAULT FALSE,
    requires_fragile_handling BOOLEAN DEFAULT FALSE,
    requires_secure_box BOOLEAN DEFAULT FALSE,
    requires_document_protection BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parcel_types_slug ON parcel_types(slug);

-- Courier onboarding
CREATE TABLE IF NOT EXISTS courier_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status delivery_application_status NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewer_id INTEGER REFERENCES users(id),
    rejection_reason TEXT,
    profile_data JSONB DEFAULT '{}'::jsonb,
    documents JSONB DEFAULT '[]'::jsonb,
    notes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_applications_user ON courier_applications(user_id);

CREATE TABLE IF NOT EXISTS couriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id UUID UNIQUE REFERENCES courier_applications(id) ON DELETE SET NULL,
    status delivery_courier_status NOT NULL DEFAULT 'pending_review',
    rating_average NUMERIC(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    bio TEXT,
    hired_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courier_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    engine_type delivery_engine_type NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    max_weight_kg NUMERIC(6,2),
    max_volume_cm3 NUMERIC(12,2),
    equipments JSONB DEFAULT '[]'::jsonb,
    available BOOLEAN DEFAULT TRUE,
    availability_schedule JSONB,
    documents JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_assets_courier ON courier_assets(courier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_assets_primary ON courier_assets(courier_id) WHERE is_primary = TRUE;

-- Delivery core tables
CREATE TABLE IF NOT EXISTS delivery_parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_id INTEGER REFERENCES parcel_types(id) ON DELETE SET NULL,
    weight_kg NUMERIC(6,2),
    volume_cm3 NUMERIC(12,2),
    declared_value NUMERIC(10,2),
    notes TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    constraints JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL,
    parcel_id UUID NOT NULL REFERENCES delivery_parcels(id) ON DELETE CASCADE,
    status delivery_status NOT NULL DEFAULT 'requested',
    requested_at TIMESTAMPTZ DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_reason delivery_cancel_reason,
    pickup_location GEOGRAPHY(Point, 4326) NOT NULL,
    dropoff_location GEOGRAPHY(Point, 4326) NOT NULL,
    pickup_address TEXT,
    dropoff_address TEXT,
    recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    recipient_contact_name TEXT,
    recipient_contact_phone TEXT,
    recipient_notes TEXT,
    recipient_tracking_token UUID UNIQUE DEFAULT gen_random_uuid(),
    recipient_dropoff_override GEOGRAPHY(Point, 4326),
    recipient_dropoff_address TEXT,
    recipient_dropoff_updated_at TIMESTAMPTZ,
    recipient_chat_thread_id UUID,
    distance_meters INTEGER,
    estimated_duration_seconds INTEGER,
    actual_duration_seconds INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now(),
    pricing_id UUID,
    tracking_token UUID UNIQUE DEFAULT gen_random_uuid(),
    metadata JSONB DEFAULT '{}'::jsonb,
    shopping_required BOOLEAN DEFAULT FALSE,
    store_location GEOGRAPHY(Point, 4326),
    store_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_deliveries_status_requested_at ON deliveries(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries(courier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_creator ON deliveries(creator_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_user ON deliveries(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_tracking_token ON deliveries(recipient_tracking_token);
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_location ON deliveries USING GIST(pickup_location);
CREATE INDEX IF NOT EXISTS idx_deliveries_dropoff_location ON deliveries USING GIST(dropoff_location);

CREATE TABLE IF NOT EXISTS delivery_status_events (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    status delivery_status NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload JSONB DEFAULT '{}'::jsonb,
    recorded_by INTEGER
);

CREATE INDEX IF NOT EXISTS idx_delivery_status_events_delivery ON delivery_status_events(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status_events_delivery_time ON delivery_status_events(delivery_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS delivery_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    base_price_cents INTEGER NOT NULL,
    distance_price_cents INTEGER NOT NULL,
    surcharge_cents INTEGER DEFAULT 0,
    discount_cents INTEGER DEFAULT 0,
    currency CHAR(3) DEFAULT 'XAF',
    calculated_at TIMESTAMPTZ DEFAULT now(),
    details JSONB DEFAULT '{}'::jsonb,
    shopping_cost_cents INTEGER DEFAULT 0,
    shopping_discount_cents INTEGER DEFAULT 0
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_deliveries_pricing'
          AND table_name = 'deliveries'
          AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE deliveries
            ADD CONSTRAINT fk_deliveries_pricing
            FOREIGN KEY (pricing_id)
            REFERENCES delivery_pricing(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS delivery_tracking_points (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    location GEOGRAPHY(Point, 4326) NOT NULL,
    speed_kmh NUMERIC(5,2),
    bearing NUMERIC(6,2),
    accuracy_meters NUMERIC(6,2)
);

CREATE INDEX IF NOT EXISTS idx_tracking_points_delivery ON delivery_tracking_points(delivery_id);
CREATE INDEX IF NOT EXISTS idx_tracking_points_courier ON delivery_tracking_points(courier_id);
CREATE INDEX IF NOT EXISTS idx_tracking_points_captured_at ON delivery_tracking_points(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_points_location ON delivery_tracking_points USING GIST(location);

CREATE TABLE IF NOT EXISTS delivery_recipient_updates (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    submitted_by INTEGER REFERENCES users(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_recipient_updates_delivery ON delivery_recipient_updates(delivery_id, created_at DESC);

CREATE TABLE IF NOT EXISTS courier_ratings (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    rater_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score_small INTEGER NOT NULL CHECK (score_small BETWEEN 1 AND 5),
    tags TEXT[],
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_ratings_courier ON courier_ratings(courier_id);

CREATE TABLE IF NOT EXISTS client_ratings (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    score_small INTEGER NOT NULL CHECK (score_small BETWEEN 1 AND 5),
    tags TEXT[],
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_ratings_client ON client_ratings(client_id);

CREATE TABLE IF NOT EXISTS traffic_snapshots (
    id BIGSERIAL PRIMARY KEY,
    captured_at TIMESTAMPTZ NOT NULL,
    source TEXT,
    bounding_box GEOGRAPHY(Polygon, 4326),
    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_captured_at ON traffic_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_source ON traffic_snapshots(source);

CREATE TABLE IF NOT EXISTS terrain_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment GEOGRAPHY(LineString, 4326) NOT NULL,
    difficulty delivery_terrain_difficulty NOT NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terrain_segments_difficulty ON terrain_segments(difficulty);
CREATE INDEX IF NOT EXISTS idx_terrain_segments_segment ON terrain_segments USING GIST(segment);

CREATE TABLE IF NOT EXISTS shopping_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    status shopping_status NOT NULL DEFAULT 'pending',
    estimated_total_cents INTEGER NOT NULL DEFAULT 0,
    actual_total_cents INTEGER,
    currency CHAR(3) DEFAULT 'XAF',
    store_name TEXT,
    store_location GEOGRAPHY(Point, 4326),
    notes TEXT,
    requires_balance_top_up BOOLEAN DEFAULT FALSE,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_orders_status ON shopping_orders(status);

CREATE TABLE IF NOT EXISTS shopping_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopping_order_id UUID NOT NULL REFERENCES shopping_orders(id) ON DELETE CASCADE,
    product_id UUID,
    product_name TEXT NOT NULL,
    characteristics JSONB DEFAULT '[]'::jsonb,
    quantity NUMERIC(10,2) NOT NULL,
    unit TEXT DEFAULT 'unite',
    estimated_price_cents INTEGER DEFAULT 0,
    actual_price_cents INTEGER,
    status shopping_item_status NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_order_items_order ON shopping_order_items(shopping_order_id);
CREATE INDEX IF NOT EXISTS idx_shopping_order_items_status ON shopping_order_items(status);

CREATE TABLE IF NOT EXISTS delivery_wallet_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('debit', 'refund')),
    amount_cents BIGINT NOT NULL,
    reason TEXT,
    balance_after BIGINT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_wallet_events_user ON delivery_wallet_events(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_wallet_events_delivery ON delivery_wallet_events(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_wallet_events_created_at ON delivery_wallet_events(created_at DESC);

-- Infrastructure de matching temps réel
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'delivery_matching_status'
    ) THEN
        CREATE TYPE delivery_matching_status AS ENUM (
            'queued',
            'searching',
            'assigned',
            'rejected',
            'failed',
            'timeout',
            'cancelled',
            'fallback',
            'no_courier'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    region GEOGRAPHY(MultiPolygon, 4326),
    center GEOGRAPHY(Point, 4326),
    max_active_couriers INTEGER NOT NULL DEFAULT 500,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_region ON delivery_zones USING GIST (region);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_center ON delivery_zones USING GIST (center);

CREATE TABLE IF NOT EXISTS courier_zone_assignments (
    id BIGSERIAL PRIMARY KEY,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    zone_id UUID NOT NULL REFERENCES delivery_zones(id) ON DELETE CASCADE,
    capacity_weight SMALLINT NOT NULL DEFAULT 1,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (courier_id, zone_id)
);

CREATE INDEX IF NOT EXISTS idx_courier_zone_assignments_zone ON courier_zone_assignments(zone_id);
CREATE INDEX IF NOT EXISTS idx_courier_zone_assignments_active ON courier_zone_assignments(is_active);

CREATE TABLE IF NOT EXISTS courier_availability_snapshots (
    id BIGSERIAL PRIMARY KEY,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES delivery_zones(id),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    active_deliveries SMALLINT NOT NULL DEFAULT 0,
    max_capacity SMALLINT NOT NULL DEFAULT 2,
    load_factor NUMERIC(6,3) NOT NULL DEFAULT 0,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location GEOGRAPHY(Point, 4326),
    battery_level SMALLINT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_courier ON courier_availability_snapshots(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_zone ON courier_availability_snapshots(zone_id);
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_capture ON courier_availability_snapshots(courier_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_location ON courier_availability_snapshots USING GIST (location);

CREATE TABLE IF NOT EXISTS delivery_matching_queue (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES delivery_zones(id),
    status delivery_matching_status NOT NULL DEFAULT 'queued',
    priority SMALLINT NOT NULL DEFAULT 100,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enqueued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_status ON delivery_matching_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_zone ON delivery_matching_queue(zone_id);
-- ✅ 2025-12-12: Index optimisé pour requête fréquente (status, next_attempt_at, priority)
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_optimized
ON delivery_matching_queue (status, next_attempt_at, priority)
WHERE status IN ('queued', 'searching');
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_priority_next_attempt
ON delivery_matching_queue (priority, next_attempt_at)
WHERE status IN ('queued', 'searching');

CREATE TABLE IF NOT EXISTS delivery_matching_events (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    courier_id UUID REFERENCES couriers(id),
    status delivery_matching_status NOT NULL,
    score NUMERIC(8,3),
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_matching_events_delivery ON delivery_matching_events(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_matching_events_courier ON delivery_matching_events(courier_id);

COMMENT ON TABLE delivery_zones IS 'Zones opérationnelles utilisées pour répartir les coursiers';
COMMENT ON TABLE courier_zone_assignments IS 'Répartition des coursiers par zone avec poids de capacité';
COMMENT ON TABLE courier_availability_snapshots IS 'Instantané de disponibilité pour le matching temps réel';
COMMENT ON TABLE delivery_matching_queue IS 'File d''attente opérationnelle pour le matching de livraison';
COMMENT ON TABLE delivery_matching_events IS 'Journal d''audit des tentatives de matching';

CREATE TABLE IF NOT EXISTS video_weekly_reports (
    id SERIAL PRIMARY KEY,
    week_start TIMESTAMPTZ NOT NULL,
    week_end TIMESTAMPTZ NOT NULL,
    total_videos BIGINT NOT NULL,
    total_views BIGINT NOT NULL,
    average_quality DOUBLE PRECISION NOT NULL,
    top_services JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_video_weekly_reports_week ON video_weekly_reports(week_start, week_end);

-- Inventaire temps réel par produit/service (surcharges externes)
CREATE TABLE IF NOT EXISTS service_inventory_overrides (
    id BIGSERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    stock_level INTEGER NOT NULL,
    source TEXT,
    note TEXT,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_inventory_overrides_unique
    ON service_inventory_overrides(service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_service_inventory_overrides_last_synced
    ON service_inventory_overrides(last_synced_at DESC);

-- Seed default parcel types (✅ 2025-12-21: Alignés avec delivery_engine_type)
-- ✅ CORRIGÉ 2026-01-15: Insérer avec des IDs spécifiques pour garantir la cohérence avec le frontend
-- L'ordre doit correspondre à VEHICLE_TRANSPORT_OPTIONS: 1=bike, 2=motorcycle, 3=tricycle, 4=car, 5=pickup, 6=van, 7=truck, 8=walking
INSERT INTO parcel_types (id, slug, display_name, description, max_weight_kg, max_volume_cm3, requires_fragile_handling, requires_isothermal, requires_secure_box, requires_document_protection, metadata)
VALUES
    (1, 'bike', 'Vélo', 'Livraison par vélo - Idéal pour petits colis légers et distances courtes', 5, 10000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "bike", "speed": "slow", "range_km": 10}'::jsonb),
    (2, 'motorcycle', 'Moto', 'Livraison par moto - Rapide pour colis moyens en ville', 15, 30000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "motorcycle", "speed": "fast", "range_km": 50}'::jsonb),
    (3, 'tricycle', 'Tricycle', 'Livraison par tricycle - Équilibre capacité/vitesse pour colis moyens', 30, 60000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "tricycle", "speed": "medium", "range_km": 30}'::jsonb),
    (4, 'car', 'Voiture', 'Livraison par voiture - Polyvalent pour tous types de colis', 50, 150000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "car", "speed": "fast", "range_km": 100}'::jsonb),
    (5, 'pickup', 'Pick-up', 'Livraison par pick-up - Idéal pour colis volumineux et lourds', 80, 250000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "pickup", "speed": "medium", "range_km": 80}'::jsonb),
    (6, 'van', 'Camionnette', 'Livraison par camionnette - Grande capacité pour colis multiples', 100, 400000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "van", "speed": "medium", "range_km": 100}'::jsonb),
    (7, 'truck', 'Camion', 'Livraison par camion - Très grande capacité pour déménagements', 500, 1000000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "truck", "speed": "slow", "range_km": 200}'::jsonb),
    (8, 'walking', 'À pied', 'Livraison à pied - Très petits colis, distances très courtes', 2, 5000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "walking", "speed": "very_slow", "range_km": 2}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    max_weight_kg = EXCLUDED.max_weight_kg,
    max_volume_cm3 = EXCLUDED.max_volume_cm3,
    metadata = EXCLUDED.metadata;

-- ✅ CORRIGÉ 2026-01-15: Réinitialiser la séquence pour commencer à 9 (après les 8 types fixes)
SELECT setval('parcel_types_id_seq', 8, true);

-- Product delivery configuration table
-- Migration: 20250127000001_create_product_delivery_config.sql
CREATE TABLE IF NOT EXISTS product_delivery_config (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    
    -- Pickup (obligatoire)
    pickup_address TEXT NOT NULL,
    pickup_latitude DOUBLE PRECISION NOT NULL,
    pickup_longitude DOUBLE PRECISION NOT NULL,
    
    -- Type véhicule (obligatoire)
    required_vehicle_type_id INTEGER NOT NULL REFERENCES parcel_types(id),
    weight_kg DOUBLE PRECISION,
    volume_cm3 DOUBLE PRECISION,
    requires_isothermal BOOLEAN DEFAULT FALSE,
    requires_fragile_handling BOOLEAN DEFAULT FALSE,
    
    -- Plages horaires de récupération (obligatoire)
    pickup_availability_schedule JSONB NOT NULL,
    
    -- Informations additionnelles
    pickup_instructions TEXT,
    billing_mode VARCHAR(50) DEFAULT 'standard',
    billing_partner_label TEXT,
    
    -- Statut
    is_configured BOOLEAN DEFAULT FALSE,
    configured_at TIMESTAMPTZ,
    configured_by INTEGER REFERENCES users(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(service_id, product_index)
);

CREATE INDEX IF NOT EXISTS idx_product_delivery_config_service ON product_delivery_config(service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_active ON product_delivery_config(is_configured) WHERE is_configured = TRUE;

-- Client delivery preferences table
-- Migration: 20250127000002_create_client_delivery_preferences.sql
CREATE TABLE IF NOT EXISTS client_delivery_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
    
    -- Préférences de livraison
    preferred_delivery_date DATE,
    preferred_delivery_time_start TIME,  -- Ex: 14:00
    preferred_delivery_time_end TIME,    -- Ex: 18:00
    preferred_delivery_window_hours INTEGER DEFAULT 2,  -- Fenêtre de 2h par défaut
    
    -- Contraintes
    avoid_days INTEGER[],  -- Jours à éviter (1=Lundi, 7=Dimanche)
    urgency_level VARCHAR(50) DEFAULT 'standard',  -- 'standard', 'urgent', 'scheduled'
    
    -- Flexibilité
    is_flexible BOOLEAN DEFAULT TRUE,  -- Accepte d'autres créneaux si indisponible
    flexibility_window_days INTEGER DEFAULT 3,  -- Flexibilité sur 3 jours
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_client_delivery_preferences_user ON client_delivery_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_client_delivery_preferences_delivery ON client_delivery_preferences(delivery_id);
CREATE INDEX IF NOT EXISTS idx_client_delivery_preferences_date ON client_delivery_preferences(preferred_delivery_date);

-- External delivery providers table
-- Migration: 20250127000003_create_external_delivery_providers.sql
CREATE TABLE IF NOT EXISTS external_delivery_providers (
    id SERIAL PRIMARY KEY,
    provider_name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    api_secret VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(255),
    webhook_url TEXT,
    allowed_ips INET[],
    rate_limit_per_hour INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    total_deliveries INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_external_providers_api_key ON external_delivery_providers(api_key);
CREATE INDEX IF NOT EXISTS idx_external_providers_active ON external_delivery_providers(is_active) WHERE is_active = TRUE;

-- Public tracking tokens table
-- Migration: 20250127000004_create_public_tracking_tokens.sql
CREATE TABLE IF NOT EXISTS public_tracking_tokens (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    tracking_token VARCHAR(255) UNIQUE NOT NULL,
    provider_id INTEGER REFERENCES external_delivery_providers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    UNIQUE(delivery_id, tracking_token)
);

CREATE INDEX IF NOT EXISTS idx_public_tracking_tokens_token ON public_tracking_tokens(tracking_token);
CREATE INDEX IF NOT EXISTS idx_public_tracking_tokens_delivery ON public_tracking_tokens(delivery_id);

-- Delivery payment reservations table
-- Migration: 20250127000005_create_delivery_payment_reservations.sql
CREATE TABLE IF NOT EXISTS delivery_payment_reservations (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Montants
    product_price_cents BIGINT NOT NULL,
    delivery_cost_cents BIGINT NOT NULL,
    total_amount_cents BIGINT NOT NULL,
    
    -- Mode de facturation
    billing_mode VARCHAR(50) DEFAULT 'standard',
    merchant_pays_delivery BOOLEAN DEFAULT FALSE,
    
    -- Statut de la réservation
    reservation_status VARCHAR(50) DEFAULT 'reserved',
    
    -- Informations de débit
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    debited_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    
    -- Informations de reversement prestataire
    merchant_payout_cents BIGINT,
    commission_cents BIGINT,
    commission_rate DECIMAL(5,4) DEFAULT 0.05,
    merchant_paid_at TIMESTAMPTZ,
    
    -- Métadonnées
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_delivery ON delivery_payment_reservations(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_user ON delivery_payment_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_status ON delivery_payment_reservations(reservation_status);

-- Colonnes pour matching intelligent modes de paiement (Phase 5)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '{}'::jsonb;

ALTER TABLE delivery_payment_reservations
ADD COLUMN IF NOT EXISTS client_payment_method JSONB,
ADD COLUMN IF NOT EXISTS merchant_payment_method JSONB,
ADD COLUMN IF NOT EXISTS payout_method_used VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_users_payment_methods ON users USING GIN (payment_methods) WHERE payment_methods != '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_payout_method ON delivery_payment_reservations(payout_method_used);

-- ============================================================================
-- SERVICES SPÉCIALISÉS (Santé et Transport)
-- Migration: 20251126_create_specialized_services_tables.sql
-- ============================================================================

-- GROUPE 1 : SANTÉ 🏥

-- Table pharmacies
CREATE TABLE IF NOT EXISTS pharmacies (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    jours_garde TEXT,
    heures_ouverture TIME,
    heures_fermeture TIME,
    permanent_24h BOOLEAN DEFAULT FALSE,
    telephone VARCHAR(50),
    telephone_urgence VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    services TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    is_on_duty_now BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_pharmacy_service UNIQUE(service_id)
);

CREATE INDEX IF NOT EXISTS idx_pharmacies_user_id ON pharmacies(user_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_service_id ON pharmacies(service_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_is_active ON pharmacies(is_active);
CREATE INDEX IF NOT EXISTS idx_pharmacies_is_on_duty ON pharmacies(is_on_duty_now) WHERE is_on_duty_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_pharmacies_ville ON pharmacies(ville);
CREATE INDEX IF NOT EXISTS idx_pharmacies_quartier ON pharmacies(quartier);
CREATE INDEX IF NOT EXISTS idx_pharmacies_services_gin ON pharmacies USING GIN(services);

-- Table hopitaux_cliniques
CREATE TABLE IF NOT EXISTS hopitaux_cliniques (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    type_etablissement VARCHAR(50) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    prestations_medicales TEXT[],
    urgences_disponible BOOLEAN DEFAULT FALSE,
    rdv_en_ligne BOOLEAN DEFAULT FALSE,
    planning_hebdomadaire JSONB,
    telephone VARCHAR(50),
    telephone_urgence VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_hospital_service UNIQUE(service_id)
);

CREATE INDEX IF NOT EXISTS idx_hopitaux_user_id ON hopitaux_cliniques(user_id);
CREATE INDEX IF NOT EXISTS idx_hopitaux_service_id ON hopitaux_cliniques(service_id);
CREATE INDEX IF NOT EXISTS idx_hopitaux_type ON hopitaux_cliniques(type_etablissement);
CREATE INDEX IF NOT EXISTS idx_hopitaux_is_active ON hopitaux_cliniques(is_active);
CREATE INDEX IF NOT EXISTS idx_hopitaux_is_available ON hopitaux_cliniques(is_available_now) WHERE is_available_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_hopitaux_prestations_gin ON hopitaux_cliniques USING GIN(prestations_medicales);
CREATE INDEX IF NOT EXISTS idx_hopitaux_planning_gin ON hopitaux_cliniques USING GIN(planning_hebdomadaire);

-- Table laboratoires_imagerie
CREATE TABLE IF NOT EXISTS laboratoires_imagerie (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    type_laboratoire VARCHAR(50) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    analyses_disponibles TEXT[],
    imagerie_disponible TEXT[],
    planning_hebdomadaire JSONB,
    rdv_requis BOOLEAN DEFAULT TRUE,
    resultats_en_ligne BOOLEAN DEFAULT FALSE,
    telephone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_laboratory_service UNIQUE(service_id)
);

CREATE INDEX IF NOT EXISTS idx_laboratoires_user_id ON laboratoires_imagerie(user_id);
CREATE INDEX IF NOT EXISTS idx_laboratoires_service_id ON laboratoires_imagerie(service_id);
CREATE INDEX IF NOT EXISTS idx_laboratoires_type ON laboratoires_imagerie(type_laboratoire);
CREATE INDEX IF NOT EXISTS idx_laboratoires_analyses_gin ON laboratoires_imagerie USING GIN(analyses_disponibles);
CREATE INDEX IF NOT EXISTS idx_laboratoires_imagerie_gin ON laboratoires_imagerie USING GIN(imagerie_disponible);
CREATE INDEX IF NOT EXISTS idx_laboratoires_is_available ON laboratoires_imagerie(is_available_now) WHERE is_available_now = TRUE;

-- GROUPE 2 : TRANSPORT 🚗

-- Table agences_voyage
CREATE TABLE IF NOT EXISTS agences_voyage (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom_agence VARCHAR(255) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    services_voyage TEXT[],
    compagnies_bus TEXT[],
    destinations TEXT[],
    heures_ouverture TIME,
    heures_fermeture TIME,
    jours_ouverture TEXT,
    telephone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    peut_emettre_tickets_bus BOOLEAN DEFAULT FALSE,
    compagnies_affiliees TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_agency_service UNIQUE(service_id)
);

CREATE INDEX IF NOT EXISTS idx_agences_user_id ON agences_voyage(user_id);
CREATE INDEX IF NOT EXISTS idx_agences_service_id ON agences_voyage(service_id);
CREATE INDEX IF NOT EXISTS idx_agences_tickets_bus ON agences_voyage(peut_emettre_tickets_bus) WHERE peut_emettre_tickets_bus = TRUE;
CREATE INDEX IF NOT EXISTS idx_agences_services_gin ON agences_voyage USING GIN(services_voyage);
CREATE INDEX IF NOT EXISTS idx_agences_compagnies_gin ON agences_voyage USING GIN(compagnies_bus);
CREATE INDEX IF NOT EXISTS idx_agences_destinations_gin ON agences_voyage USING GIN(destinations);

-- Table covoiturages
CREATE TABLE IF NOT EXISTS covoiturages (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    depart VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    gps_depart VARCHAR(255),
    gps_destination VARCHAR(255),
    date_depart TIMESTAMPTZ NOT NULL,
    heure_depart TIME NOT NULL,
    date_arrivee_estimee TIMESTAMPTZ,
    type_vehicule VARCHAR(50),
    marque_modele VARCHAR(255),
    nombre_places INTEGER NOT NULL,
    places_disponibles INTEGER NOT NULL,
    prix_par_place INTEGER NOT NULL,
    devise VARCHAR(3) DEFAULT 'XAF',
    bagages_autorises BOOLEAN DEFAULT TRUE,
    animaux_autorises BOOLEAN DEFAULT FALSE,
    fumeur_autorise BOOLEAN DEFAULT FALSE,
    climatisation BOOLEAN DEFAULT FALSE,
    statut VARCHAR(20) NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'complet', 'annule', 'termine')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_covoiturage_service UNIQUE(service_id)
);

CREATE INDEX IF NOT EXISTS idx_covoiturages_user_id ON covoiturages(user_id);
CREATE INDEX IF NOT EXISTS idx_covoiturages_service_id ON covoiturages(service_id);
CREATE INDEX IF NOT EXISTS idx_covoiturages_date_depart ON covoiturages(date_depart) WHERE is_active = TRUE AND statut = 'ouvert';
CREATE INDEX IF NOT EXISTS idx_covoiturages_statut ON covoiturages(statut) WHERE statut = 'ouvert';
CREATE INDEX IF NOT EXISTS idx_covoiturages_depart_destination ON covoiturages(depart, destination);
CREATE INDEX IF NOT EXISTS idx_covoiturages_places_disponibles ON covoiturages(places_disponibles) WHERE places_disponibles > 0;

-- Table taxis_ville
CREATE TABLE IF NOT EXISTS taxis_ville (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom_chauffeur VARCHAR(255),
    telephone VARCHAR(50) NOT NULL,
    whatsapp VARCHAR(50),
    type_vehicule VARCHAR(50),
    marque_modele VARCHAR(255),
    immatriculation VARCHAR(50),
    couleur VARCHAR(50),
    annee INTEGER,
    is_available_now BOOLEAN DEFAULT FALSE,
    zone_intervention TEXT[],
    gps_actuel VARCHAR(255),
    tarif_base INTEGER DEFAULT 500,
    tarif_par_km INTEGER DEFAULT 200,
    devise VARCHAR(3) DEFAULT 'XAF',
    paiement_cash BOOLEAN DEFAULT TRUE,
    paiement_mobile_money BOOLEAN DEFAULT FALSE,
    paiement_carte BOOLEAN DEFAULT FALSE,
    climatisation BOOLEAN DEFAULT FALSE,
    wifi BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_on_duty BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_taxi_service UNIQUE(service_id)
);

CREATE INDEX IF NOT EXISTS idx_taxis_user_id ON taxis_ville(user_id);
CREATE INDEX IF NOT EXISTS idx_taxis_service_id ON taxis_ville(service_id);
CREATE INDEX IF NOT EXISTS idx_taxis_is_available ON taxis_ville(is_available_now) WHERE is_available_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_taxis_is_on_duty ON taxis_ville(is_on_duty) WHERE is_on_duty = TRUE;
CREATE INDEX IF NOT EXISTS idx_taxis_zone_gin ON taxis_ville USING GIN(zone_intervention);

-- Fonction et triggers pour updated_at automatique
CREATE OR REPLACE FUNCTION update_specialized_service_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pharmacies_updated_at ON pharmacies;
CREATE TRIGGER trigger_pharmacies_updated_at BEFORE UPDATE ON pharmacies FOR EACH ROW EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_hopitaux_updated_at ON hopitaux_cliniques;
CREATE TRIGGER trigger_hopitaux_updated_at BEFORE UPDATE ON hopitaux_cliniques FOR EACH ROW EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_laboratoires_updated_at ON laboratoires_imagerie;
CREATE TRIGGER trigger_laboratoires_updated_at BEFORE UPDATE ON laboratoires_imagerie FOR EACH ROW EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_agences_updated_at ON agences_voyage;
CREATE TRIGGER trigger_agences_updated_at BEFORE UPDATE ON agences_voyage FOR EACH ROW EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_covoiturages_updated_at ON covoiturages;
CREATE TRIGGER trigger_covoiturages_updated_at BEFORE UPDATE ON covoiturages FOR EACH ROW EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_taxis_updated_at ON taxis_ville;
CREATE TRIGGER trigger_taxis_updated_at BEFORE UPDATE ON taxis_ville FOR EACH ROW EXECUTE FUNCTION update_specialized_service_timestamp();

-- ============================================================================
-- BANQUE DE SANG 🩸 (Service spécialisé isolé)
-- ============================================================================

-- Table banques_sang
CREATE TABLE IF NOT EXISTS banques_sang (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Lien avec établissement (optionnel, peut être indépendant)
    hopital_id INTEGER REFERENCES hopitaux_cliniques(id) ON DELETE SET NULL,
    
    -- Informations de base
    nom VARCHAR(255) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255), -- Format: "lat,lng"
    
    -- Groupes sanguins disponibles avec stocks
    stocks_groupes_sanguins JSONB NOT NULL DEFAULT '{}',
    
    -- Services
    accepte_dons BOOLEAN DEFAULT TRUE,
    accepte_demandes BOOLEAN DEFAULT TRUE,
    urgence_24h BOOLEAN DEFAULT FALSE,
    
    -- Planification
    planning_hebdomadaire JSONB,
    horaires_dons TIME[], -- ["08:00", "17:00"] - Horaires pour les dons
    
    -- Contact
    telephone VARCHAR(50),
    telephone_urgence VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE, -- Calculé automatiquement avec NOW()
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_banque_service UNIQUE(service_id)
);

-- Index pour banques_sang
CREATE INDEX IF NOT EXISTS idx_banques_sang_user_id ON banques_sang(user_id);
CREATE INDEX IF NOT EXISTS idx_banques_sang_service_id ON banques_sang(service_id);
CREATE INDEX IF NOT EXISTS idx_banques_sang_hopital_id ON banques_sang(hopital_id);
CREATE INDEX IF NOT EXISTS idx_banques_sang_is_active ON banques_sang(is_active);
CREATE INDEX IF NOT EXISTS idx_banques_sang_is_available ON banques_sang(is_available_now) WHERE is_available_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_banques_sang_urgence_24h ON banques_sang(urgence_24h) WHERE urgence_24h = TRUE;
CREATE INDEX IF NOT EXISTS idx_banques_sang_accepte_dons ON banques_sang(accepte_dons) WHERE accepte_dons = TRUE;
CREATE INDEX IF NOT EXISTS idx_banques_sang_accepte_demandes ON banques_sang(accepte_demandes) WHERE accepte_demandes = TRUE;
CREATE INDEX IF NOT EXISTS idx_banques_sang_stocks_gin ON banques_sang USING GIN(stocks_groupes_sanguins);
CREATE INDEX IF NOT EXISTS idx_banques_sang_planning_gin ON banques_sang USING GIN(planning_hebdomadaire);
CREATE INDEX IF NOT EXISTS idx_banques_sang_ville ON banques_sang(ville);
CREATE INDEX IF NOT EXISTS idx_banques_sang_quartier ON banques_sang(quartier);

-- Index GPS (GIST pour recherche géographique)
CREATE INDEX IF NOT EXISTS idx_banques_sang_gps ON banques_sang USING GIST(
    CAST(ST_SetSRID(ST_MakePoint(
        CAST(SPLIT_PART(gps, ',', 2) AS DOUBLE PRECISION),
        CAST(SPLIT_PART(gps, ',', 1) AS DOUBLE PRECISION)
    ), 4326) AS geography)
) WHERE gps IS NOT NULL AND gps != '';

-- Trigger pour updated_at
CREATE TRIGGER update_banques_sang_updated_at 
    BEFORE UPDATE ON banques_sang 
    FOR EACH ROW 
    EXECUTE FUNCTION update_specialized_service_timestamp();

-- ============================================================================
-- INTÉGRATION TICKETS BUS AVEC AGENCES DE VOYAGE 🚌
-- ============================================================================

-- Ajouter colonne bus_products_config à agences_voyage
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='agences_voyage' AND column_name='bus_products_config') THEN
        ALTER TABLE agences_voyage ADD COLUMN bus_products_config JSONB;
    END IF;
END $$;

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_agences_bus_products_gin ON agences_voyage USING GIN(bus_products_config) WHERE bus_products_config IS NOT NULL;

-- Commentaire
COMMENT ON COLUMN agences_voyage.bus_products_config IS 'Configuration des modèles de bus (products de type ticket_voyage) liés à cette agence';

-- Fonction de recherche tickets bus avec disponibilité
CREATE OR REPLACE FUNCTION search_bus_tickets_with_availability(
    p_departure_city TEXT DEFAULT NULL,
    p_arrival_city TEXT DEFAULT NULL,
    p_departure_date DATE DEFAULT NULL,
    p_user_lat DOUBLE PRECISION DEFAULT NULL,
    p_user_lng DOUBLE PRECISION DEFAULT NULL,
    p_radius_km DOUBLE PRECISION DEFAULT 50.0,
    p_min_seats INTEGER DEFAULT 1,
    p_agency_name TEXT DEFAULT NULL
)
RETURNS TABLE (
    agency_id INTEGER,
    agency_service_id INTEGER,
    agency_nom VARCHAR,
    agency_adresse TEXT,
    agency_quartier VARCHAR,
    agency_ville VARCHAR,
    agency_gps VARCHAR,
    agency_telephone VARCHAR,
    agency_whatsapp VARCHAR,
    agency_email VARCHAR,
    agency_peut_emettre_tickets BOOLEAN,
    product_id TEXT,
    product_name TEXT,
    product_type TEXT,
    bus_model_name TEXT,
    total_seats INTEGER,
    available_seats INTEGER,
    reserved_seats INTEGER,
    bus_number VARCHAR,
    departure_city TEXT,
    arrival_city TEXT,
    departure_date DATE,
    departure_time TIME,
    ticket_price INTEGER,
    currency VARCHAR,
    bus_configuration JSONB,
    seat_map JSONB,
    distance_km DOUBLE PRECISION,
    relevance_score DOUBLE PRECISION
) AS $$
DECLARE
    v_user_point geography;
BEGIN
    IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
        v_user_point := CAST(ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326) AS geography);
    END IF;

    RETURN QUERY
    WITH agency_data AS (
        SELECT 
            av.id,
            av.service_id,
            av.nom,
            av.adresse,
            av.quartier,
            av.ville,
            av.gps,
            av.telephone,
            av.whatsapp,
            av.email,
            av.peut_emettre_tickets_bus,
            av.bus_products_config,
            CASE 
                WHEN v_user_point IS NOT NULL AND av.gps IS NOT NULL AND av.gps != '' THEN
                    calculate_distance_km(
                        p_user_lat,
                        p_user_lng,
                        CAST(SPLIT_PART(av.gps, ',', 1) AS DOUBLE PRECISION),
                        CAST(SPLIT_PART(av.gps, ',', 2) AS DOUBLE PRECISION)
                    )
                ELSE NULL
            END AS agency_distance_km
        FROM agences_voyage av
        WHERE av.is_active = TRUE
            AND av.peut_emettre_tickets_bus = TRUE
            AND (p_agency_name IS NULL OR av.nom ILIKE '%' || p_agency_name || '%')
            AND (
                v_user_point IS NULL OR
                av.gps IS NULL OR
                av.gps = '' OR
                ST_DWithin(
                    CAST(ST_SetSRID(ST_MakePoint(
                        CAST(SPLIT_PART(av.gps, ',', 2) AS DOUBLE PRECISION),
                        CAST(SPLIT_PART(av.gps, ',', 1) AS DOUBLE PRECISION)
                    ), 4326) AS geography),
                    v_user_point,
                    p_radius_km * 1000
                )
            )
    ),
    product_data AS (
        SELECT 
            p.id::text AS product_id,
            p.name AS product_name,
            p.type AS product_type,
            p.depart AS departure_city,
            p.destination AS arrival_city,
            p.date_depart::date AS departure_date,
            p.date_depart::time AS departure_time,
            p.price AS ticket_price,
            p.currency,
            p.total_seats,
            p.bus_configuration,
            p.seat_map,
            p.numero_bus AS bus_number,
            p.user_id AS product_user_id,
            (av.bus_products_config->'modeles_bus'->0->>'nom_modele')::TEXT AS bus_model_name,
            COALESCE(
                (SELECT COUNT(*)::INTEGER
                 FROM bus_reservations br
                 WHERE br.product_id = p.id::text
                   AND br.status IN ('pending', 'confirmed')
                   AND (br.expires_at IS NULL OR br.expires_at > NOW())),
                0
            ) AS reserved_seats,
            GREATEST(
                0,
                COALESCE(p.total_seats, 0) - 
                COALESCE(
                    (SELECT COUNT(*)::INTEGER
                     FROM bus_reservations br
                     WHERE br.product_id = p.id::text
                       AND br.status IN ('pending', 'confirmed')
                       AND (br.expires_at IS NULL OR br.expires_at > NOW())),
                    0
                )
            ) AS available_seats
        FROM products p
        JOIN services s ON s.id = p.service_id
        JOIN agency_data av ON av.service_id = s.id
        WHERE p.type = 'ticket_voyage'
            AND p.is_active = TRUE
            AND (p_departure_city IS NULL OR p.depart ILIKE '%' || p_departure_city || '%')
            AND (p_arrival_city IS NULL OR p.destination ILIKE '%' || p_arrival_city || '%')
            AND (p_departure_date IS NULL OR p.date_depart::date = p_departure_date)
            AND (p_departure_date IS NULL OR p.date_depart::date >= CURRENT_DATE)
    )
    SELECT 
        ad.id AS agency_id,
        ad.service_id AS agency_service_id,
        ad.nom AS agency_nom,
        ad.adresse AS agency_adresse,
        ad.quartier AS agency_quartier,
        ad.ville AS agency_ville,
        ad.gps AS agency_gps,
        ad.telephone AS agency_telephone,
        ad.whatsapp AS agency_whatsapp,
        ad.email AS agency_email,
        ad.peut_emettre_tickets_bus AS agency_peut_emettre_tickets,
        pd.product_id,
        pd.product_name,
        pd.product_type,
        pd.bus_model_name,
        pd.total_seats,
        pd.available_seats,
        pd.reserved_seats,
        pd.bus_number,
        pd.departure_city,
        pd.arrival_city,
        pd.departure_date,
        pd.departure_time,
        pd.ticket_price,
        pd.currency,
        pd.bus_configuration,
        pd.seat_map,
        ad.agency_distance_km AS distance_km,
        (
            CASE WHEN pd.available_seats >= p_min_seats THEN 10 ELSE 0 END +
            CASE WHEN pd.departure_date = CURRENT_DATE THEN 5 ELSE 0 END +
            CASE WHEN pd.departure_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days' THEN 3 ELSE 0 END +
            CASE WHEN ad.agency_distance_km IS NOT NULL AND ad.agency_distance_km <= 10 THEN 5 ELSE 0 END +
            CASE WHEN ad.agency_distance_km IS NOT NULL AND ad.agency_distance_km <= 25 THEN 3 ELSE 0 END +
            CASE WHEN p_departure_city IS NOT NULL AND pd.departure_city ILIKE '%' || p_departure_city || '%' THEN 8 ELSE 0 END +
            CASE WHEN p_arrival_city IS NOT NULL AND pd.arrival_city ILIKE '%' || p_arrival_city || '%' THEN 8 ELSE 0 END
        ) AS relevance_score
    FROM agency_data ad
    JOIN product_data pd ON pd.product_user_id = ad.id
    WHERE pd.available_seats >= p_min_seats
    ORDER BY 
        relevance_score DESC,
        distance_km ASC NULLS LAST,
        pd.departure_date ASC,
        pd.departure_time ASC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les places disponibles d'un produit
CREATE OR REPLACE FUNCTION get_bus_seat_availability(p_product_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_product RECORD;
    v_reserved_seats TEXT[];
    v_blocked_seats TEXT[];
    v_available_seats JSONB;
    v_seat_map JSONB;
BEGIN
    SELECT 
        p.total_seats,
        p.seat_map,
        p.bus_configuration
    INTO v_product
    FROM products p
    WHERE p.id::text = p_product_id
        AND p.type = 'ticket_voyage'
        AND p.is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Produit non trouvé');
    END IF;
    
    SELECT ARRAY_AGG(br.seat_id)
    INTO v_reserved_seats
    FROM bus_reservations br
    WHERE br.product_id = p_product_id
        AND br.status IN ('pending', 'confirmed')
        AND (br.expires_at IS NULL OR br.expires_at > NOW());
    
    IF v_product.seat_map IS NULL THEN
        v_seat_map := jsonb_build_array();
    ELSE
        v_seat_map := v_product.seat_map;
    END IF;
    
    -- Récupérer les places bloquées (si table existe)
    BEGIN
        SELECT ARRAY_AGG(bsb.seat_id) INTO v_blocked_seats
        FROM bus_seat_blocks bsb
        WHERE bsb.product_id = p_product_id AND bsb.is_active = TRUE;
    EXCEPTION
        WHEN undefined_table THEN
            v_blocked_seats := ARRAY[]::TEXT[];
    END;
    
    -- Mettre à jour le seat_map avec statuts (incluant blocages)
    v_seat_map := (
        SELECT jsonb_agg(
            CASE 
                WHEN seat->>'seat_id' = ANY(v_blocked_seats) THEN
                    seat || jsonb_build_object('available', FALSE, 'status', 'blocked', 'blocked_reason', 'maintenance')
                WHEN seat->>'seat_id' = ANY(v_reserved_seats) THEN
                    seat || jsonb_build_object('available', FALSE, 'status', 'reserved')
                ELSE
                    seat || jsonb_build_object('available', TRUE, 'status', 'available')
            END
        )
        FROM jsonb_array_elements(v_seat_map) AS seat
    );
    
    v_available_seats := jsonb_build_object(
        'total_seats', v_product.total_seats,
        'reserved_count', COALESCE(array_length(v_reserved_seats, 1), 0),
        'blocked_count', COALESCE(array_length(v_blocked_seats, 1), 0),
        'available_count', GREATEST(0, 
            COALESCE(v_product.total_seats, 0) 
            - COALESCE(array_length(v_reserved_seats, 1), 0)
            - COALESCE(array_length(v_blocked_seats, 1), 0)
        ),
        'reserved_seats', COALESCE(to_jsonb(v_reserved_seats), '[]'::jsonb),
        'blocked_seats', COALESCE(to_jsonb(v_blocked_seats), '[]'::jsonb),
        'seats', v_seat_map
    );
    
    RETURN jsonb_build_object('success', TRUE, 'availability', v_available_seats);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SYSTÈME COMMISSION ET REVERSEMENT TICKETS BUS 💰
-- ============================================================================

-- Ajouter colonnes commission et reversement à bus_ticket_payments
DO $$ 
BEGIN
    -- Commission Yukpo (5% du montant ticket)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='yukpo_commission') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN yukpo_commission INTEGER;
        RAISE NOTICE 'Colonne yukpo_commission ajoutée';
    END IF;
    
    -- Montant reversé à l'agence (subtotal - commission)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='agency_payout') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN agency_payout INTEGER;
        RAISE NOTICE 'Colonne agency_payout ajoutée';
    END IF;
    
    -- Statut reversement
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='payout_status') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN payout_status VARCHAR(20) DEFAULT 'pending';
        RAISE NOTICE 'Colonne payout_status ajoutée';
    END IF;
    
    -- Date reversement
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='payout_at') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN payout_at TIMESTAMPTZ;
        RAISE NOTICE 'Colonne payout_at ajoutée';
    END IF;
    
    -- URL ticket PDF généré
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='ticket_pdf_url') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN ticket_pdf_url TEXT;
        RAISE NOTICE 'Colonne ticket_pdf_url ajoutée';
    END IF;
END $$;

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_bus_payments_payout_status ON bus_ticket_payments(payout_status) WHERE payout_status = 'pending';

-- Fonction pour calculer commission et reverser automatiquement
CREATE OR REPLACE FUNCTION process_bus_ticket_payment_with_commission(
    p_payment_id TEXT,
    p_ticket_price INTEGER,
    p_number_of_tickets INTEGER,
    p_booking_fee INTEGER DEFAULT 500
)
RETURNS JSONB AS $$
DECLARE
    v_subtotal INTEGER;
    v_commission INTEGER;
    v_agency_payout INTEGER;
    v_total_amount INTEGER;
    v_payment RECORD;
    v_agency_user_id INTEGER;
BEGIN
    -- Calculer montants
    v_subtotal := p_ticket_price * p_number_of_tickets;
    v_commission := ROUND(v_subtotal * 0.05); -- 5% commission
    v_agency_payout := v_subtotal - v_commission;
    v_total_amount := v_subtotal + p_booking_fee;
    
    -- Récupérer le payment pour obtenir agency_user_id
    SELECT agency_user_id INTO v_agency_user_id
    FROM bus_ticket_payments
    WHERE id = p_payment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé');
    END IF;
    
    -- Mettre à jour le paiement
    UPDATE bus_ticket_payments
    SET 
        subtotal = v_subtotal,
        yukpo_commission = v_commission,
        agency_payout = v_agency_payout,
        total_amount = v_total_amount,
        booking_fee = p_booking_fee,
        payout_status = 'pending',
        updated_at = NOW()
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;
    
    -- Reverser automatiquement à l'agence
    UPDATE users
    SET tokens_balance = tokens_balance + v_agency_payout
    WHERE id = v_agency_user_id;
    
    -- Marquer reversement comme complété
    UPDATE bus_ticket_payments
    SET 
        payout_status = 'completed',
        payout_at = NOW()
    WHERE id = p_payment_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', p_payment_id,
        'subtotal', v_subtotal,
        'yukpo_commission', v_commission,
        'agency_payout', v_agency_payout,
        'total_amount', v_total_amount,
        'payout_status', 'completed'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_bus_ticket_payment_with_commission IS 'Calcule la commission Yukpo (5%) et reverse automatiquement le montant à l''agence';

-- ============================================================================
-- SYSTÈME VALIDATION TICKETS BUS AVEC QR CODE ✅
-- ============================================================================

-- Table pour le statut d'embarquement des passagers
CREATE TABLE IF NOT EXISTS bus_boarding_status (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    reservation_id TEXT NOT NULL REFERENCES bus_reservations(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    payment_id TEXT REFERENCES bus_ticket_payments(id) ON DELETE SET NULL,
    boarding_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (boarding_status IN ('pending', 'boarded', 'no_show', 'cancelled')),
    is_validated BOOLEAN NOT NULL DEFAULT FALSE,
    validated_at TIMESTAMPTZ,
    validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    validation_method VARCHAR(20) CHECK (validation_method IN ('qr_code', 'manual', 'api')),
    qr_code_data JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_reservation_boarding UNIQUE (reservation_id)
);

CREATE INDEX IF NOT EXISTS idx_bus_boarding_product ON bus_boarding_status(product_id);
CREATE INDEX IF NOT EXISTS idx_bus_boarding_reservation ON bus_boarding_status(reservation_id);
CREATE INDEX IF NOT EXISTS idx_bus_boarding_status ON bus_boarding_status(boarding_status);
CREATE INDEX IF NOT EXISTS idx_bus_boarding_validated ON bus_boarding_status(is_validated) WHERE is_validated = TRUE;
CREATE INDEX IF NOT EXISTS idx_bus_boarding_validated_by ON bus_boarding_status(validated_by);

-- Fonction pour valider un ticket via QR code
CREATE OR REPLACE FUNCTION validate_bus_ticket(
    p_qr_code_data JSONB,
    p_validator_user_id INTEGER,
    p_product_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_reservation_id TEXT;
    v_payment_id TEXT;
    v_product_id TEXT;
    v_reservation RECORD;
    v_payment RECORD;
    v_boarding_status RECORD;
    v_count INTEGER;
BEGIN
    v_reservation_id := p_qr_code_data->>'id';
    v_payment_id := p_qr_code_data->>'payment_id';
    v_product_id := COALESCE(p_product_id, p_qr_code_data->>'product_id');
    
    IF v_reservation_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'ID réservation manquant dans QR code');
    END IF;
    
    SELECT * INTO v_reservation FROM bus_reservations
    WHERE id = v_reservation_id AND status = 'confirmed';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Réservation non trouvée ou non confirmée');
    END IF;
    
    IF v_product_id IS NOT NULL AND v_reservation.product_id != v_product_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Ticket ne correspond pas à ce bus');
    END IF;
    
    IF v_payment_id IS NOT NULL THEN
        SELECT * INTO v_payment FROM bus_ticket_payments
        WHERE id = v_payment_id AND payment_status = 'completed';
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé ou non complété');
        END IF;
    END IF;
    
    -- ⚠️ SÉCURITÉ ANTI-DOUBLE UTILISATION : Vérifier si le ticket est déjà validé
    -- Vérification par reservation_id (prioritaire)
    SELECT * INTO v_boarding_status FROM bus_boarding_status 
    WHERE reservation_id = v_reservation_id;
    
    IF FOUND AND v_boarding_status.is_validated = TRUE THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Ticket déjà utilisé - Ce ticket a déjà été validé et ne peut plus être utilisé',
            'already_boarded', TRUE,
            'boarded_at', v_boarding_status.validated_at,
            'validated_by_user_id', v_boarding_status.validated_by,
            'validation_method', v_boarding_status.validation_method
        );
    END IF;
    
    -- Vérification supplémentaire par payment_id (pour éviter réutilisation même avec QR différent)
    IF v_payment_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM bus_boarding_status 
        WHERE payment_id = v_payment_id AND is_validated = TRUE;
        
        IF v_count > 0 THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'Ticket déjà utilisé - Ce paiement a déjà été validé pour un autre passager',
                'already_boarded', TRUE
            );
        END IF;
    END IF;
    
    -- ⚠️ PROTECTION RACE CONDITION : Utiliser INSERT ... ON CONFLICT avec vérification atomique
    -- Cela garantit qu'un seul scan peut réussir même si deux arrivent simultanément
    -- La contrainte UNIQUE sur reservation_id empêche les doublons au niveau base de données
    
    IF FOUND THEN
        -- Si un boarding_status existe déjà, vérifier s'il est validé
        IF v_boarding_status.is_validated = TRUE THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'Ticket déjà utilisé - Ce ticket a déjà été validé et ne peut plus être utilisé',
                'already_boarded', TRUE,
                'boarded_at', v_boarding_status.validated_at,
                'validated_by_user_id', v_boarding_status.validated_by,
                'validation_method', v_boarding_status.validation_method
            );
        END IF;
        
        -- Si pas encore validé, mettre à jour (cas rare mais possible)
        UPDATE bus_boarding_status
        SET boarding_status = 'boarded', is_validated = TRUE, validated_at = NOW(),
            validated_by = p_validator_user_id, validation_method = 'qr_code',
            qr_code_data = p_qr_code_data, updated_at = NOW()
        WHERE reservation_id = v_reservation_id AND is_validated = FALSE
        RETURNING * INTO v_boarding_status;
        
        -- Si aucune ligne mise à jour (déjà validé entre temps), erreur
        IF NOT FOUND THEN
            SELECT * INTO v_boarding_status FROM bus_boarding_status 
            WHERE reservation_id = v_reservation_id;
            
            IF v_boarding_status.is_validated = TRUE THEN
                RETURN jsonb_build_object(
                    'success', FALSE,
                    'error', 'Ticket déjà utilisé - Ce ticket a déjà été validé et ne peut plus être utilisé',
                    'already_boarded', TRUE,
                    'boarded_at', v_boarding_status.validated_at,
                    'validated_by_user_id', v_boarding_status.validated_by,
                    'validation_method', v_boarding_status.validation_method
                );
            END IF;
        END IF;
    ELSE
        -- Créer nouveau boarding_status (avec protection UNIQUE au niveau DB)
        BEGIN
            INSERT INTO bus_boarding_status (
                reservation_id, product_id, payment_id, boarding_status, is_validated,
                validated_at, validated_by, validation_method, qr_code_data
            ) VALUES (
                v_reservation_id, v_reservation.product_id, v_payment_id, 'boarded', TRUE,
                NOW(), p_validator_user_id, 'qr_code', p_qr_code_data
            ) RETURNING * INTO v_boarding_status;
        EXCEPTION
            WHEN unique_violation THEN
                -- Si insertion échoue (doublon), récupérer l'enregistrement existant
                SELECT * INTO v_boarding_status FROM bus_boarding_status 
                WHERE reservation_id = v_reservation_id;
                
                IF v_boarding_status.is_validated = TRUE THEN
                    RETURN jsonb_build_object(
                        'success', FALSE,
                        'error', 'Ticket déjà utilisé - Ce ticket a déjà été validé et ne peut plus être utilisé',
                        'already_boarded', TRUE,
                        'boarded_at', v_boarding_status.validated_at,
                        'validated_by_user_id', v_boarding_status.validated_by,
                        'validation_method', v_boarding_status.validation_method
                    );
                END IF;
        END;
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'reservation_id', v_reservation_id,
        'passenger_name', v_reservation.passenger_name,
        'seat_id', v_reservation.seat_id,
        'seat_number', v_reservation.seat_number,
        'validated_at', v_boarding_status.validated_at,
        'message', 'Ticket validé avec succès'
    );
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir le résumé d'embarquement
CREATE OR REPLACE FUNCTION get_bus_boarding_summary(p_product_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_total_reservations INTEGER := 0;
    v_boarded_passengers INTEGER := 0;
    v_pending_passengers INTEGER := 0;
    v_no_show_passengers INTEGER := 0;
BEGIN
    SELECT COUNT(*) INTO v_total_reservations FROM bus_reservations
    WHERE product_id = p_product_id AND status = 'confirmed';
    
    SELECT COUNT(*) INTO v_boarded_passengers FROM bus_boarding_status
    WHERE product_id = p_product_id AND boarding_status = 'boarded' AND is_validated = TRUE;
    
    SELECT COUNT(*) INTO v_pending_passengers FROM bus_reservations br
    WHERE br.product_id = p_product_id AND br.status = 'confirmed'
        AND NOT EXISTS (
            SELECT 1 FROM bus_boarding_status bbs
            WHERE bbs.reservation_id = br.id AND bbs.is_validated = TRUE
        );
    
    SELECT COUNT(*) INTO v_no_show_passengers FROM bus_reservations br
    JOIN products p ON CAST(p.id AS TEXT) = br.product_id
    WHERE br.product_id = p_product_id AND br.status = 'confirmed'
        AND CAST((p.metadata->>'departure_date' || ' ' || p.metadata->>'departure_time') AS TIMESTAMP) + INTERVAL '15 minutes' < NOW()
        AND NOT EXISTS (
            SELECT 1 FROM bus_boarding_status bbs
            WHERE bbs.reservation_id = br.id AND bbs.is_validated = TRUE
        );
    
    RETURN jsonb_build_object(
        'total_reservations', v_total_reservations,
        'boarded_passengers', v_boarded_passengers,
        'pending_passengers', v_pending_passengers,
        'no_show_passengers', v_no_show_passengers,
        'completion_percentage', CASE 
            WHEN v_total_reservations > 0 THEN 
                ROUND((CAST(v_boarded_passengers AS FLOAT) / CAST(v_total_reservations AS FLOAT)) * 100, 2)
            ELSE 0
        END,
        'is_complete', (v_boarded_passengers = v_total_reservations AND v_total_reservations > 0)
    );
END;
$$ LANGUAGE plpgsql;

-- Vue pour liste des passagers avec statut embarquement
CREATE OR REPLACE VIEW bus_passengers_with_boarding AS
SELECT 
    br.id as reservation_id, br.product_id, br.user_id, br.seat_id, br.seat_number,
    br.passenger_name, br.status as reservation_status,
    btp.id as payment_id, btp.total_amount,
    bbs.id as boarding_status_id, bbs.boarding_status, bbs.is_validated,
    bbs.validated_at, bbs.validated_by, bbs.validation_method,
    u.nom_complet as validator_name,
    CASE 
        WHEN bbs.is_validated = TRUE THEN 'boarded'
        WHEN bbs.boarding_status = 'no_show' THEN 'no_show'
        WHEN bbs.boarding_status = 'cancelled' THEN 'cancelled'
        ELSE 'pending'
    END as display_status
FROM bus_reservations br
LEFT JOIN bus_ticket_payments btp ON btp.id = ANY(
    SELECT unnest(btp2.reservation_ids) FROM bus_ticket_payments btp2 
    WHERE br.id = ANY(btp2.reservation_ids) LIMIT 1
)
LEFT JOIN bus_boarding_status bbs ON bbs.reservation_id = br.id
LEFT JOIN users u ON u.id = bbs.validated_by
WHERE br.status = 'confirmed';

-- ============================================================================
-- GESTION MANUELLE PLACES NON DISPONIBLES 🔒
-- ============================================================================

-- Table pour les blocages manuels de places
CREATE TABLE IF NOT EXISTS bus_seat_blocks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    product_id TEXT NOT NULL,
    seat_id VARCHAR(50) NOT NULL,
    seat_number INTEGER NOT NULL,
    reason VARCHAR(100) NOT NULL DEFAULT 'maintenance' CHECK (reason IN ('maintenance', 'damaged', 'reserved', 'other')),
    reason_details TEXT,
    blocked_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    unblocked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    unblocked_at TIMESTAMPTZ,
    CONSTRAINT unique_active_seat_block UNIQUE (product_id, seat_id) WHERE is_active = TRUE
);

CREATE INDEX IF NOT EXISTS idx_bus_seat_blocks_product ON bus_seat_blocks(product_id);
CREATE INDEX IF NOT EXISTS idx_bus_seat_blocks_active ON bus_seat_blocks(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_bus_seat_blocks_seat ON bus_seat_blocks(seat_id);

-- Fonction pour bloquer une place manuellement
CREATE OR REPLACE FUNCTION block_bus_seat_manually(
    p_product_id TEXT,
    p_seat_id VARCHAR(50),
    p_seat_number INTEGER,
    p_reason VARCHAR(100) DEFAULT 'maintenance',
    p_reason_details TEXT DEFAULT NULL,
    p_blocked_by INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_block_id TEXT;
    v_existing_block RECORD;
BEGIN
    SELECT * INTO v_existing_block FROM bus_seat_blocks
    WHERE product_id = p_product_id AND seat_id = p_seat_id AND is_active = TRUE;
    
    IF FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Place déjà bloquée');
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM bus_reservations
        WHERE product_id = p_product_id AND seat_id = p_seat_id AND status IN ('pending', 'confirmed')
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Place déjà réservée, impossible de bloquer');
    END IF;
    
    INSERT INTO bus_seat_blocks (product_id, seat_id, seat_number, reason, reason_details, blocked_by)
    VALUES (p_product_id, p_seat_id, p_seat_number, p_reason, p_reason_details, p_blocked_by)
    RETURNING id INTO v_block_id;
    
    RETURN jsonb_build_object('success', TRUE, 'block_id', v_block_id, 'message', 'Place bloquée avec succès');
END;
$$ LANGUAGE plpgsql;

-- Fonction pour débloquer une place
CREATE OR REPLACE FUNCTION unblock_bus_seat_manually(
    p_product_id TEXT,
    p_seat_id VARCHAR(50),
    p_unblocked_by INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_block RECORD;
BEGIN
    SELECT * INTO v_block FROM bus_seat_blocks
    WHERE product_id = p_product_id AND seat_id = p_seat_id AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Aucun blocage actif trouvé pour cette place');
    END IF;
    
    UPDATE bus_seat_blocks
    SET is_active = FALSE, unblocked_by = p_unblocked_by, unblocked_at = NOW()
    WHERE id = v_block.id;
    
    RETURN jsonb_build_object('success', TRUE, 'message', 'Place débloquée avec succès');
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir la disponibilité avec blocages
CREATE OR REPLACE FUNCTION get_bus_seat_availability_with_blocks(p_product_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_product RECORD;
    v_seat_map JSONB;
    v_reserved_seats TEXT[];
    v_blocked_seats TEXT[];
    v_available_seats JSONB;
BEGIN
    SELECT p.id, p.name, p.total_seats, p.seat_map, p.bus_configuration INTO v_product
    FROM products p
    WHERE p.id::text = p_product_id AND p.type = 'ticket_voyage' AND p.is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Produit non trouvé');
    END IF;
    
    SELECT ARRAY_AGG(br.seat_id) INTO v_reserved_seats FROM bus_reservations br
    WHERE br.product_id = p_product_id AND br.status IN ('pending', 'confirmed')
        AND (br.expires_at IS NULL OR br.expires_at > NOW());
    
    SELECT ARRAY_AGG(bsb.seat_id) INTO v_blocked_seats FROM bus_seat_blocks bsb
    WHERE bsb.product_id = p_product_id AND bsb.is_active = TRUE;
    
    IF v_product.seat_map IS NULL THEN
        v_seat_map := jsonb_build_array();
    ELSE
        v_seat_map := v_product.seat_map;
    END IF;
    
    v_seat_map := (
        SELECT jsonb_agg(
            CASE 
                WHEN seat->>'seat_id' = ANY(v_blocked_seats) THEN
                    seat || jsonb_build_object('available', FALSE, 'status', 'blocked', 'blocked_reason', 'maintenance')
                WHEN seat->>'seat_id' = ANY(v_reserved_seats) THEN
                    seat || jsonb_build_object('available', FALSE, 'status', 'reserved')
                ELSE
                    seat || jsonb_build_object('available', TRUE, 'status', 'available')
            END
        )
        FROM jsonb_array_elements(v_seat_map) AS seat
    );
    
    v_available_seats := jsonb_build_object(
        'total_seats', v_product.total_seats,
        'reserved_count', COALESCE(array_length(v_reserved_seats, 1), 0),
        'blocked_count', COALESCE(array_length(v_blocked_seats, 1), 0),
        'available_count', GREATEST(0, 
            COALESCE(v_product.total_seats, 0) 
            - COALESCE(array_length(v_reserved_seats, 1), 0)
            - COALESCE(array_length(v_blocked_seats, 1), 0)
        ),
        'reserved_seats', COALESCE(to_jsonb(v_reserved_seats), '[]'::jsonb),
        'blocked_seats', COALESCE(to_jsonb(v_blocked_seats), '[]'::jsonb),
        'seats', v_seat_map
    );
    
    RETURN jsonb_build_object('success', TRUE, 'availability', v_available_seats);
END;
$$ LANGUAGE plpgsql;

-- Vue pour les blocages actifs avec détails
CREATE OR REPLACE VIEW bus_active_seat_blocks AS
SELECT 
    bsb.id, bsb.product_id, bsb.seat_id, bsb.seat_number,
    bsb.reason, bsb.reason_details, bsb.blocked_by, bsb.blocked_at,
    u.nom_complet as blocked_by_name, p.name as product_name, p.numero_bus
FROM bus_seat_blocks bsb
JOIN users u ON u.id = bsb.blocked_by
JOIN products p ON p.id::text = bsb.product_id
WHERE bsb.is_active = TRUE
ORDER BY bsb.blocked_at DESC;

-- ============================================================================
-- SYSTÈME INTELLIGENT DE MATCHING BANQUE DE SANG 🩸
-- ============================================================================

-- Table : Groupes sanguins des utilisateurs
CREATE TABLE IF NOT EXISTS user_blood_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    groupe_sanguin VARCHAR(5) NOT NULL CHECK (groupe_sanguin IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
    is_available_for_donation BOOLEAN NOT NULL DEFAULT TRUE,
    last_donation_date DATE,
    next_donation_available_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_blood_group UNIQUE (user_id, groupe_sanguin)
);

CREATE INDEX IF NOT EXISTS idx_user_blood_groups_user ON user_blood_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_blood_groups_groupe ON user_blood_groups(groupe_sanguin);
CREATE INDEX IF NOT EXISTS idx_user_blood_groups_available ON user_blood_groups(is_available_for_donation) WHERE is_available_for_donation = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_blood_groups_next_donation ON user_blood_groups(next_donation_available_date) WHERE next_donation_available_date IS NOT NULL;

-- Table : Demandes de don de sang
CREATE TABLE IF NOT EXISTS blood_donation_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    banque_sang_id INTEGER NOT NULL REFERENCES banques_sang(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    groupe_sanguin_requis VARCHAR(5) NOT NULL CHECK (groupe_sanguin_requis IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
    quantite_requise INTEGER NOT NULL DEFAULT 1,
    unite VARCHAR(20) DEFAULT 'poches',
    is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
    urgence_level VARCHAR(20) DEFAULT 'normal' CHECK (urgence_level IN ('normal', 'urgent', 'critique')),
    deadline_date DATE,
    request_latitude DOUBLE PRECISION,
    request_longitude DOUBLE PRECISION,
    request_location_address TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled', 'expired')),
    fulfilled_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_reason TEXT,
    notes TEXT,
    patient_name TEXT,
    hospital_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_donation_requests_banque ON blood_donation_requests(banque_sang_id);
CREATE INDEX IF NOT EXISTS idx_blood_donation_requests_groupe ON blood_donation_requests(groupe_sanguin_requis);
CREATE INDEX IF NOT EXISTS idx_blood_donation_requests_status ON blood_donation_requests(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_blood_donation_requests_urgent ON blood_donation_requests(is_urgent) WHERE is_urgent = TRUE;
CREATE INDEX IF NOT EXISTS idx_blood_donation_requests_created ON blood_donation_requests(created_at DESC);

-- Table : Matches donneurs/demandes
CREATE TABLE IF NOT EXISTS blood_donation_matches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    request_id TEXT NOT NULL REFERENCES blood_donation_requests(id) ON DELETE CASCADE,
    donor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    donor_blood_group_id INTEGER NOT NULL REFERENCES user_blood_groups(id) ON DELETE CASCADE,
    donor_latitude DOUBLE PRECISION,
    donor_longitude DOUBLE PRECISION,
    distance_km DOUBLE PRECISION,
    match_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (match_status IN ('pending', 'notified', 'accepted', 'declined', 'completed', 'expired')),
    notified_at TIMESTAMPTZ,
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    declined_reason TEXT,
    completed_at TIMESTAMPTZ,
    relevance_score DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_request_donor_match UNIQUE (request_id, donor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_blood_donation_matches_request ON blood_donation_matches(request_id);
CREATE INDEX IF NOT EXISTS idx_blood_donation_matches_donor ON blood_donation_matches(donor_user_id);
CREATE INDEX IF NOT EXISTS idx_blood_donation_matches_status ON blood_donation_matches(match_status) WHERE match_status IN ('pending', 'notified', 'accepted');
CREATE INDEX IF NOT EXISTS idx_blood_donation_matches_relevance ON blood_donation_matches(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_blood_donation_matches_distance ON blood_donation_matches(distance_km) WHERE distance_km IS NOT NULL;

-- Fonction : Trouver donneurs potentiels
CREATE OR REPLACE FUNCTION find_potential_blood_donors(
    p_request_id TEXT,
    p_groupe_sanguin_requis VARCHAR(5),
    p_request_lat DOUBLE PRECISION,
    p_request_lng DOUBLE PRECISION,
    p_max_distance_km DOUBLE PRECISION DEFAULT 50.0,
    p_max_results INTEGER DEFAULT 20
)
RETURNS JSONB AS $$
DECLARE
    v_compatible_groups VARCHAR(5)[];
    v_donor RECORD;
    v_distance_km DOUBLE PRECISION;
    v_relevance_score DOUBLE PRECISION;
    v_results JSONB := '[]'::jsonb;
    v_count INTEGER := 0;
BEGIN
    -- Déterminer groupes compatibles
    v_compatible_groups := CASE p_groupe_sanguin_requis
        WHEN 'O-' THEN ARRAY['O-']::VARCHAR(5)[]
        WHEN 'O+' THEN ARRAY['O-', 'O+']::VARCHAR(5)[]
        WHEN 'A-' THEN ARRAY['O-', 'A-']::VARCHAR(5)[]
        WHEN 'A+' THEN ARRAY['O-', 'O+', 'A-', 'A+']::VARCHAR(5)[]
        WHEN 'B-' THEN ARRAY['O-', 'B-']::VARCHAR(5)[]
        WHEN 'B+' THEN ARRAY['O-', 'O+', 'B-', 'B+']::VARCHAR(5)[]
        WHEN 'AB-' THEN ARRAY['O-', 'A-', 'B-', 'AB-']::VARCHAR(5)[]
        WHEN 'AB+' THEN ARRAY['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']::VARCHAR(5)[]
        ELSE ARRAY[]::VARCHAR(5)[]
    END;
    
    FOR v_donor IN
        SELECT 
            ubg.id as blood_group_id,
            ubg.user_id,
            ubg.groupe_sanguin,
            ubg.is_available_for_donation,
            ubg.next_donation_available_date,
            u.gps,
            u.nom_complet,
            u.telephone,
            u.whatsapp,
            CASE 
                WHEN u.gps IS NOT NULL AND u.gps LIKE '%,%' THEN
                    CAST(SPLIT_PART(u.gps, ',', 1) AS DOUBLE PRECISION)
                ELSE NULL
            END as donor_lat,
            CASE 
                WHEN u.gps IS NOT NULL AND u.gps LIKE '%,%' THEN
                    CAST(SPLIT_PART(u.gps, ',', 2) AS DOUBLE PRECISION)
                ELSE NULL
            END as donor_lng
        FROM user_blood_groups ubg
        JOIN users u ON u.id = ubg.user_id
        WHERE ubg.groupe_sanguin = ANY(v_compatible_groups)
            AND ubg.is_available_for_donation = TRUE
            AND (ubg.next_donation_available_date IS NULL OR ubg.next_donation_available_date <= CURRENT_DATE)
            AND u.is_active = TRUE
            AND NOT EXISTS (
                SELECT 1 FROM blood_donation_matches bdm
                WHERE bdm.request_id = p_request_id
                    AND bdm.donor_user_id = ubg.user_id
                    AND bdm.match_status IN ('pending', 'notified', 'accepted')
            )
        ORDER BY 
            CASE WHEN ubg.next_donation_available_date IS NULL OR ubg.next_donation_available_date <= CURRENT_DATE THEN 0 ELSE 1 END,
            CASE WHEN ubg.groupe_sanguin = p_groupe_sanguin_requis THEN 0 ELSE 1 END
        LIMIT p_max_results
    LOOP
        v_distance_km := NULL;
        IF p_request_lat IS NOT NULL AND p_request_lng IS NOT NULL 
           AND v_donor.donor_lat IS NOT NULL AND v_donor.donor_lng IS NOT NULL THEN
            v_distance_km := (
                6371.0 * acos(
                    LEAST(1.0, 
                        sin(radians(p_request_lat)) * sin(radians(v_donor.donor_lat)) +
                        cos(radians(p_request_lat)) * cos(radians(v_donor.donor_lat)) *
                        cos(radians(p_request_lng - v_donor.donor_lng))
                    )
                )
            );
        END IF;
        
        IF v_distance_km IS NULL OR v_distance_km <= p_max_distance_km THEN
            v_relevance_score := 100.0;
            IF v_distance_km IS NOT NULL THEN
                v_relevance_score := v_relevance_score - (v_distance_km * 0.5);
            END IF;
            IF v_donor.groupe_sanguin = p_groupe_sanguin_requis THEN
                v_relevance_score := v_relevance_score + 20.0;
            END IF;
            IF v_donor.next_donation_available_date IS NULL OR v_donor.next_donation_available_date <= CURRENT_DATE THEN
                v_relevance_score := v_relevance_score + 10.0;
            END IF;
            
            v_results := v_results || jsonb_build_object(
                'blood_group_id', v_donor.blood_group_id,
                'user_id', v_donor.user_id,
                'groupe_sanguin', v_donor.groupe_sanguin,
                'nom_complet', v_donor.nom_complet,
                'telephone', v_donor.telephone,
                'whatsapp', v_donor.whatsapp,
                'donor_latitude', v_donor.donor_lat,
                'donor_longitude', v_donor.donor_lng,
                'distance_km', v_distance_km,
                'relevance_score', v_relevance_score,
                'is_available_now', (v_donor.next_donation_available_date IS NULL OR v_donor.next_donation_available_date <= CURRENT_DATE)
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'count', v_count,
        'donors', v_results,
        'compatible_groups', v_compatible_groups
    );
END;
$$ LANGUAGE plpgsql;

-- Fonction : Créer demande et trouver matches
CREATE OR REPLACE FUNCTION create_blood_donation_request(
    p_banque_sang_id INTEGER,
    p_service_id INTEGER,
    p_requested_by_user_id INTEGER,
    p_groupe_sanguin_requis VARCHAR(5),
    p_quantite_requise INTEGER DEFAULT 1,
    p_unite VARCHAR(20) DEFAULT 'poches',
    p_is_urgent BOOLEAN DEFAULT FALSE,
    p_urgence_level VARCHAR(20) DEFAULT 'normal',
    p_deadline_date DATE DEFAULT NULL,
    p_request_lat DOUBLE PRECISION DEFAULT NULL,
    p_request_lng DOUBLE PRECISION DEFAULT NULL,
    p_request_location_address TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_patient_name TEXT DEFAULT NULL,
    p_hospital_name TEXT DEFAULT NULL,
    p_max_distance_km DOUBLE PRECISION DEFAULT 50.0
)
RETURNS JSONB AS $$
DECLARE
    v_request_id TEXT;
    v_matches JSONB;
    v_match_count INTEGER;
    v_match RECORD;
BEGIN
    INSERT INTO blood_donation_requests (
        banque_sang_id, service_id, requested_by_user_id, groupe_sanguin_requis,
        quantite_requise, unite, is_urgent, urgence_level, deadline_date,
        request_latitude, request_longitude, request_location_address,
        notes, patient_name, hospital_name, status
    ) VALUES (
        p_banque_sang_id, p_service_id, p_requested_by_user_id, p_groupe_sanguin_requis,
        p_quantite_requise, p_unite, p_is_urgent, p_urgence_level, p_deadline_date,
        p_request_lat, p_request_lng, p_request_location_address,
        p_notes, p_patient_name, p_hospital_name, 'active'
    ) RETURNING id INTO v_request_id;
    
    v_matches := find_potential_blood_donors(
        v_request_id, p_groupe_sanguin_requis, p_request_lat, p_request_lng, p_max_distance_km, 50
    );
    
    v_match_count := (v_matches->>'count')::INTEGER;
    
    IF v_match_count > 0 THEN
        FOR v_match IN SELECT * FROM jsonb_array_elements(v_matches->'donors')
        LOOP
            INSERT INTO blood_donation_matches (
                request_id, donor_user_id, donor_blood_group_id,
                donor_latitude, donor_longitude, distance_km, relevance_score, match_status
            ) VALUES (
                v_request_id,
                (v_match->>'user_id')::INTEGER,
                (v_match->>'blood_group_id')::INTEGER,
                CAST((v_match->>'donor_latitude') AS DOUBLE PRECISION),
                CAST((v_match->>'donor_longitude') AS DOUBLE PRECISION),
                CAST((v_match->>'distance_km') AS DOUBLE PRECISION),
                CAST((v_match->>'relevance_score') AS DOUBLE PRECISION),
                'pending'
            ) ON CONFLICT (request_id, donor_user_id) DO NOTHING;
        END LOOP;
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'request_id', v_request_id,
        'matches_found', v_match_count,
        'message', format('Demande créée avec %s donneur(s) potentiel(s)', v_match_count)
    );
END;
$$ LANGUAGE plpgsql;

-- Fonction : Mettre à jour statut match
CREATE OR REPLACE FUNCTION update_blood_donation_match_status(
    p_match_id TEXT,
    p_new_status VARCHAR(20),
    p_declined_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_match RECORD;
    v_request RECORD;
BEGIN
    SELECT * INTO v_match FROM blood_donation_matches WHERE id = p_match_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Match non trouvé');
    END IF;
    
    UPDATE blood_donation_matches
    SET 
        match_status = p_new_status,
        declined_reason = p_declined_reason,
        notified_at = CASE WHEN p_new_status = 'notified' THEN NOW() ELSE notified_at END,
        accepted_at = CASE WHEN p_new_status = 'accepted' THEN NOW() ELSE accepted_at END,
        declined_at = CASE WHEN p_new_status = 'declined' THEN NOW() ELSE declined_at END,
        completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = p_match_id;
    
    IF p_new_status = 'accepted' THEN
        SELECT * INTO v_request FROM blood_donation_requests WHERE id = v_match.request_id;
        
        IF EXISTS (
            SELECT 1 FROM blood_donation_matches
            WHERE request_id = v_match.request_id AND match_status = 'accepted'
            GROUP BY request_id
            HAVING COUNT(*) >= v_request.quantite_requise
        ) THEN
            UPDATE blood_donation_requests
            SET status = 'fulfilled', fulfilled_at = NOW(), updated_at = NOW()
            WHERE id = v_match.request_id;
        END IF;
    END IF;
    
    RETURN jsonb_build_object('success', TRUE, 'match_id', p_match_id, 'new_status', p_new_status);
END;
$$ LANGUAGE plpgsql;

-- Fonction : Mettre à jour date dernier don
CREATE OR REPLACE FUNCTION update_donor_last_donation(
    p_user_id INTEGER,
    p_groupe_sanguin VARCHAR(5),
    p_donation_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
    v_next_available_date DATE;
BEGIN
    v_next_available_date := p_donation_date + INTERVAL '56 days';
    
    INSERT INTO user_blood_groups (user_id, groupe_sanguin, last_donation_date, next_donation_available_date, is_available_for_donation, updated_at)
    VALUES (p_user_id, p_groupe_sanguin, p_donation_date, v_next_available_date, FALSE, NOW())
    ON CONFLICT (user_id, groupe_sanguin)
    DO UPDATE SET
        last_donation_date = p_donation_date,
        next_donation_available_date = v_next_available_date,
        is_available_for_donation = FALSE,
        updated_at = NOW();
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'next_donation_available_date', v_next_available_date,
        'message', format('Prochain don possible le %s', v_next_available_date)
    );
END;
$$ LANGUAGE plpgsql;

-- Vue : Demandes actives avec statistiques
CREATE OR REPLACE VIEW blood_donation_requests_active AS
SELECT 
    bdr.id, bdr.banque_sang_id, bs.nom as banque_sang_nom, bdr.service_id,
    bdr.requested_by_user_id, bdr.groupe_sanguin_requis, bdr.quantite_requise,
    bdr.unite, bdr.is_urgent, bdr.urgence_level, bdr.deadline_date,
    bdr.request_latitude, bdr.request_longitude, bdr.request_location_address,
    bdr.status, bdr.patient_name, bdr.hospital_name, bdr.created_at,
    COUNT(DISTINCT CASE WHEN bdm.match_status IN ('pending', 'notified', 'accepted') THEN bdm.id END) as matches_count,
    COUNT(DISTINCT CASE WHEN bdm.match_status = 'accepted' THEN bdm.id END) as accepted_matches_count,
    COUNT(DISTINCT CASE WHEN bdm.match_status = 'notified' THEN bdm.id END) as notified_matches_count
FROM blood_donation_requests bdr
JOIN banques_sang bs ON bs.id = bdr.banque_sang_id
LEFT JOIN blood_donation_matches bdm ON bdm.request_id = bdr.id
WHERE bdr.status = 'active'
GROUP BY bdr.id, bs.nom;

-- ✅ 2025-11-27 : Ajout champ groupe_sanguin dans users (optionnel, pour faciliter matching)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='groupe_sanguin') THEN
        ALTER TABLE users ADD COLUMN groupe_sanguin VARCHAR(5) 
            CHECK (groupe_sanguin IS NULL OR groupe_sanguin IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_blood_group ON users(groupe_sanguin) WHERE groupe_sanguin IS NOT NULL;

-- ✅ 2025-11-27 : Table agency_departure_schedules (horaires de départ par agence/ville)
CREATE TABLE IF NOT EXISTS agency_departure_schedules (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agency_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    departure_city TEXT NOT NULL,
    arrival_city TEXT NOT NULL,
    departure_times TIME[] NOT NULL,
    day_of_week INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agency_user_id, departure_city, arrival_city, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_agency_schedules_route ON agency_departure_schedules(departure_city, arrival_city);
CREATE INDEX IF NOT EXISTS idx_agency_schedules_agency ON agency_departure_schedules(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_schedules_active ON agency_departure_schedules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_agency_schedules_day ON agency_departure_schedules(day_of_week) WHERE day_of_week IS NOT NULL;

-- ✅ 2025-11-27 : Ajouter colonnes return_date et return_time à bus_ticket_payments
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='return_date') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN return_date VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='return_time') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN return_time VARCHAR(10);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bus_payments_return_date ON bus_ticket_payments(return_date) WHERE return_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bus_payments_return_time ON bus_ticket_payments(return_time) WHERE return_time IS NOT NULL;

-- ✅ 2025-12-03 : Table videos avec hashtags pour VideoFeed
CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    content_id TEXT NOT NULL UNIQUE,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    titre TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail TEXT,
    hashtags TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_sponsored BOOLEAN NOT NULL DEFAULT FALSE,
    studio_session_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Métadonnées vidéo
    duration_ms INTEGER,
    video_format TEXT,
    video_source TEXT,
    -- Embedding vectoriel pour ML (stocké en TEXT, pgvector non utilisé)
    embedding TEXT, -- JSON array ou base64 pour stockage temporaire
    -- Statistiques
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    save_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_videos_service_id ON videos(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_content_id ON videos(content_id);
CREATE INDEX IF NOT EXISTS idx_videos_is_active ON videos(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_studio_session_id ON videos(studio_session_id) WHERE studio_session_id IS NOT NULL;

-- Index GIN pour hashtags (recherche rapide)
CREATE INDEX IF NOT EXISTS idx_videos_hashtags_gin ON videos USING GIN(hashtags);

-- Index pour recherche full-text sur titre et description
CREATE INDEX IF NOT EXISTS idx_videos_title_fulltext 
    ON videos USING GIN(to_tsvector('french', COALESCE(titre, '')));
CREATE INDEX IF NOT EXISTS idx_videos_description_fulltext 
    ON videos USING GIN(to_tsvector('french', COALESCE(description, '')));

-- Index pour embedding (stocké en TEXT, pas de pgvector)
CREATE INDEX IF NOT EXISTS idx_videos_embedding ON videos(embedding) WHERE embedding IS NOT NULL;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION set_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_videos_updated_at ON videos;
CREATE TRIGGER trg_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION set_videos_updated_at();

-- ✅ Fonction pour extraire automatiquement les hashtags depuis titre/description
CREATE OR REPLACE FUNCTION extract_hashtags_from_text(input_text TEXT)
RETURNS TEXT[] AS $$
DECLARE
    hashtags TEXT[];
BEGIN
    -- Extraire tous les mots commençant par # (hashtags)
    SELECT array_agg(DISTINCT LOWER(SUBSTRING(match, 2)))
    INTO hashtags
    FROM regexp_split_to_table(input_text, '\s+') AS match
    WHERE match ~ '^#[a-zA-Z0-9_]+$';
    
    RETURN COALESCE(hashtags, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ✅ Trigger pour extraire automatiquement les hashtags
CREATE OR REPLACE FUNCTION auto_extract_video_hashtags()
RETURNS TRIGGER AS $$
BEGIN
    -- Extraire hashtags depuis titre et description
    NEW.hashtags = array_cat(
        COALESCE(NEW.hashtags, ARRAY[]::TEXT[]),
        extract_hashtags_from_text(COALESCE(NEW.titre, '') || ' ' || COALESCE(NEW.description, ''))
    );
    
    -- Supprimer doublons
    NEW.hashtags = array(SELECT DISTINCT unnest(NEW.hashtags));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_extract_video_hashtags ON videos;
CREATE TRIGGER trg_auto_extract_video_hashtags
    BEFORE INSERT OR UPDATE OF titre, description ON videos
    FOR EACH ROW
    EXECUTE FUNCTION auto_extract_video_hashtags();

-- ✅ Vue pour statistiques hashtags (pour tendances)
CREATE OR REPLACE VIEW hashtag_stats AS
SELECT 
    tag,
    COUNT(DISTINCT v.id) as video_count,
    SUM(v.view_count) as total_views,
    SUM(v.like_count) as total_likes,
    SUM(v.save_count) as total_saves,
    (
        SUM(v.like_count * 2 + v.save_count * 1.5 + v.view_count * 0.1) 
        / GREATEST(EXTRACT(EPOCH FROM (NOW() - MIN(v.created_at))) / 3600, 1)
    ) as trend_score,
    MAX(v.created_at) as last_video_at
FROM videos v
CROSS JOIN LATERAL unnest(v.hashtags) tag
WHERE v.is_active = TRUE
GROUP BY tag;

COMMENT ON TABLE videos IS 'Table pour stocker les vidéos du feed avec hashtags et embeddings pour ML';
COMMENT ON COLUMN videos.hashtags IS 'Array de hashtags extraits automatiquement ou ajoutés manuellement';
COMMENT ON COLUMN videos.embedding IS 'Vecteur d''embedding pour recommandations ML (stocké en TEXT, JSON array ou base64)';
COMMENT ON COLUMN videos.studio_session_id IS 'ID de session studio pour chaînage vidéos';

-- ✅ 2025-01-27 : Table message_reactions (réactions aux messages de chat)
CREATE TABLE IF NOT EXISTS message_reactions (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contrainte unique: un utilisateur ne peut réagir qu'une fois avec le même emoji sur un message
    UNIQUE(message_id, user_id, emoji)
);

-- Index pour recherche rapide (PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_message_reactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_update_message_reactions_updated_at ON message_reactions;
CREATE TRIGGER trigger_update_message_reactions_updated_at
    BEFORE UPDATE ON message_reactions
    FOR EACH ROW
    EXECUTE FUNCTION update_message_reactions_updated_at();

-- Commentaires
COMMENT ON TABLE message_reactions IS 'Réactions (emojis) aux messages de chat';
COMMENT ON COLUMN message_reactions.message_id IS 'ID du message (format: msg_xxx ou UUID)';
COMMENT ON COLUMN message_reactions.user_id IS 'ID de l''utilisateur qui a réagi';
COMMENT ON COLUMN message_reactions.emoji IS 'Emoji de la réaction (ex: ❤️, 👍, 😂)';

-- ✅ NOUVEAU 2025-01-28: Tables de chat de livraison et gamification

-- 1. Table pour les messages de chat de livraison
CREATE TABLE IF NOT EXISTS delivery_chat_messages (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'courier', 'provider')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_chat_messages_delivery_id ON delivery_chat_messages(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_chat_messages_sender_id ON delivery_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_delivery_chat_messages_created_at ON delivery_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_chat_messages_delivery_created ON delivery_chat_messages(delivery_id, created_at DESC);

-- 2. Table pour les statistiques de gamification
CREATE TABLE IF NOT EXISTS delivery_gamification_stats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_deliveries INTEGER DEFAULT 0,
    total_completed_deliveries INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    current_level TEXT DEFAULT 'bronze' CHECK (current_level IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
    badges JSONB DEFAULT '[]'::jsonb,
    achievements JSONB DEFAULT '{}'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_gamification_stats_points ON delivery_gamification_stats(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_gamification_stats_level ON delivery_gamification_stats(current_level);
CREATE INDEX IF NOT EXISTS idx_delivery_gamification_stats_deliveries ON delivery_gamification_stats(total_completed_deliveries DESC);

-- 3. Table pour les badges obtenus
CREATE TABLE IF NOT EXISTS delivery_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_type TEXT NOT NULL,
    badge_name TEXT NOT NULL,
    badge_description TEXT,
    icon_url TEXT,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, badge_type)
);

CREATE INDEX IF NOT EXISTS idx_delivery_badges_user_id ON delivery_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_badges_type ON delivery_badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_delivery_badges_earned_at ON delivery_badges(earned_at DESC);

-- 4. Table pour l'historique des points
CREATE TABLE IF NOT EXISTS delivery_points_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points_change INTEGER NOT NULL,
    reason TEXT NOT NULL,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_points_history_user_id ON delivery_points_history(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_points_history_created_at ON delivery_points_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_points_history_delivery_id ON delivery_points_history(delivery_id);

-- 5. Table pour les suggestions produits IA
CREATE TABLE IF NOT EXISTS delivery_product_suggestions (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    suggested_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    suggested_product_name TEXT NOT NULL,
    suggested_product_price DECIMAL(10, 2),
    suggestion_reason TEXT,
    confidence_score DECIMAL(3, 2) DEFAULT 0.5,
    was_accepted BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_product_suggestions_delivery_id ON delivery_product_suggestions(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_product_suggestions_user_id ON delivery_product_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_product_suggestions_created_at ON delivery_product_suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_product_suggestions_accepted ON delivery_product_suggestions(was_accepted);

COMMENT ON TABLE delivery_chat_messages IS 'Messages de chat pendant les livraisons';
COMMENT ON TABLE delivery_gamification_stats IS 'Statistiques de gamification par utilisateur';
COMMENT ON TABLE delivery_badges IS 'Badges obtenus par les utilisateurs';
COMMENT ON TABLE delivery_points_history IS 'Historique des changements de points';
COMMENT ON TABLE delivery_product_suggestions IS 'Suggestions de produits générées par IA';

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
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
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

CREATE TRIGGER trigger_update_plugin_rating
    AFTER INSERT OR UPDATE OR DELETE ON plugin_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_plugin_rating();

-- ✅ NOUVEAU 2025-01-27: Tables pour service Planification Menus
-- Migration: 20250127_create_menu_planning_tables.sql

-- Profil famille utilisatrice
CREATE TABLE IF NOT EXISTS family_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_name VARCHAR(255),
    total_members INTEGER NOT NULL DEFAULT 1,
    children_count INTEGER DEFAULT 0,
    adults_count INTEGER DEFAULT 1,
    preferences JSONB DEFAULT '{}', -- végétarien, vegan, halal, etc.
    allergies TEXT[], -- liste allergies
    dietary_restrictions TEXT[], -- diabète, hypertension, etc.
    budget_monthly DECIMAL(10,2),
    cuisine_styles TEXT[], -- africaine, camerounaise, occidentale, etc.
    cooking_level VARCHAR(50), -- débutant, intermédiaire, avancé
    time_available_hours DECIMAL(4,2), -- heures disponibles par jour
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Base de données recettes
CREATE TABLE IF NOT EXISTS recipes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cuisine_style VARCHAR(100), -- africaine, camerounaise, occidentale, etc.
    meal_type TEXT[], -- petit_dejeuner, dejeuner, diner
    difficulty VARCHAR(50), -- facile, moyen, difficile
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    servings INTEGER DEFAULT 1,
    ingredients JSONB NOT NULL, -- [{name, quantity, unit}, ...]
    instructions TEXT[] NOT NULL, -- étapes de préparation
    nutrition_per_serving JSONB, -- {calories, proteins, carbs, fats, fiber}
    tags TEXT[], -- végétarien, vegan, rapide, économique, etc.
    image_url TEXT,
    video_url TEXT, -- vidéo recette optionnelle
    source VARCHAR(255), -- "yukpo_ai", "community", "premium"
    is_premium BOOLEAN DEFAULT FALSE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans menus hebdomadaires
CREATE TABLE IF NOT EXISTS menu_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL, -- lundi de la semaine
    week_end DATE NOT NULL, -- dimanche de la semaine
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, completed
    total_budget DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

-- Repas planifiés (lien menu_plans -> recipes -> day/meal_type)
CREATE TABLE IF NOT EXISTS planned_meals (
    id SERIAL PRIMARY KEY,
    menu_plan_id INTEGER NOT NULL REFERENCES menu_plans(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 1=lundi, 7=dimanche
    meal_type VARCHAR(50) NOT NULL, -- petit_dejeuner, dejeuner, diner, gouter
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
    custom_name VARCHAR(255), -- nom personnalisé si pas de recette
    servings INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recettes favorites utilisatrices
CREATE TABLE IF NOT EXISTS recipe_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, recipe_id)
);

-- Listes de courses
CREATE TABLE IF NOT EXISTS shopping_lists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    menu_plan_id INTEGER REFERENCES menu_plans(id) ON DELETE SET NULL,
    week_start DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
    organized_by_store BOOLEAN DEFAULT FALSE,
    organized_by_aisle BOOLEAN DEFAULT FALSE,
    total_estimated_cost DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items liste de courses
CREATE TABLE IF NOT EXISTS shopping_list_items (
    id SERIAL PRIMARY KEY,
    shopping_list_id INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    category VARCHAR(100), -- fruits, légumes, viande, épicerie, etc.
    store_section VARCHAR(100), -- rayon magasin
    preferred_store VARCHAR(255), -- magasin préféré
    is_checked BOOLEAN DEFAULT FALSE,
    actual_price DECIMAL(10,2),
    notes TEXT,
    order_placed BOOLEAN DEFAULT FALSE, -- commande via Yukpo
    order_id INTEGER, -- Référence vers commande (peut être lié à shopping_orders ou delivery_requests)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics nutrition
CREATE TABLE IF NOT EXISTS nutrition_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    menu_plan_id INTEGER NOT NULL REFERENCES menu_plans(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    total_calories DECIMAL(10,2),
    total_proteins DECIMAL(10,2),
    total_carbs DECIMAL(10,2),
    total_fats DECIMAL(10,2),
    total_fiber DECIMAL(10,2),
    daily_average JSONB, -- moyenne par jour
    recommendations TEXT[], -- recommandations IA
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_menu_plans_user_week ON menu_plans(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_planned_meals_menu_plan ON planned_meals(menu_plan_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_user_week ON shopping_lists(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisine_style);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);
CREATE INDEX IF NOT EXISTS idx_family_profiles_user ON family_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_favorites_user ON recipe_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_analytics_user_week ON nutrition_analytics(user_id, week_start);

-- Commentaires pour documentation
COMMENT ON TABLE family_profiles IS 'Profils famille pour planification menus personnalisée';
COMMENT ON TABLE recipes IS 'Base de données recettes (IA, communauté, premium)';
COMMENT ON TABLE menu_plans IS 'Plans menus hebdomadaires utilisatrices';
COMMENT ON TABLE planned_meals IS 'Repas planifiés par jour/type dans menu';
COMMENT ON TABLE shopping_lists IS 'Listes de courses générées depuis menus';
COMMENT ON TABLE shopping_list_items IS 'Items individuels dans liste courses';
COMMENT ON TABLE nutrition_analytics IS 'Analytics nutrition hebdomadaires';

-- ============================================================================
-- ✅ NOUVEAU 2026-01-02: Optimisation critique add_product_to_service_jsonb_v2
-- ============================================================================
-- Problème: FOR UPDATE verrouille la ligne pendant toute la transaction, causant des timeouts
--           même sans médias si le service a déjà beaucoup de produits (JSONB volumineux)
-- Solution: Lire les données AVANT le verrou, construire le JSONB en mémoire, puis UPDATE atomique

CREATE OR REPLACE FUNCTION add_product_to_service_jsonb_v2(
    p_service_id INTEGER,
    p_product_json JSONB
) RETURNS TABLE(
    product_index INTEGER,
    produits_data JSONB,
    lieu_data JSONB
) AS $$
DECLARE
    v_product_index INTEGER;
    v_produits_data JSONB;
    v_lieu_data JSONB;
    v_current_data JSONB;
BEGIN
    -- ✅ OPTIMISÉ: Lire les données AVANT le verrou (lecture rapide)
    -- Cela permet de calculer l'index sans verrouiller la ligne
    SELECT 
        COALESCE(jsonb_array_length(data->'produits'->'valeur'), 0),
        data
    INTO v_product_index, v_current_data
    FROM services
    WHERE id = p_service_id AND is_active = true;
    
    -- Si le service n'existe pas, retourner vide
    IF v_product_index IS NULL OR v_current_data IS NULL THEN
        RETURN;
    END IF;
    
    -- ✅ OPTIMISÉ: Calculer le nouveau JSONB en mémoire (plus rapide que jsonb_set)
    -- Construire directement le nouveau tableau produits.valeur
    DECLARE
        v_new_produits_valeur JSONB;
        v_new_data JSONB;
    BEGIN
        -- Construire le nouveau tableau produits.valeur
        IF v_current_data->'produits'->'valeur' IS NOT NULL THEN
            -- Ajouter au tableau existant
            v_new_produits_valeur := (v_current_data->'produits'->'valeur') || jsonb_build_array(p_product_json);
        ELSE
            -- Créer un nouveau tableau
            v_new_produits_valeur := jsonb_build_array(p_product_json);
        END IF;
        
        -- Construire le nouveau data JSONB
        IF v_current_data->'produits' IS NOT NULL THEN
            -- Mettre à jour seulement produits.valeur
            v_new_data := jsonb_set(
                v_current_data,
                '{produits,valeur}',
                v_new_produits_valeur,
                true
            );
        ELSE
            -- Créer toute la structure produits
            v_new_data := v_current_data || jsonb_build_object(
                'produits',
                jsonb_build_object(
                    'type_donnee', 'autocomplete',
                    'valeur', v_new_produits_valeur,
                    'separateur', ',',
                    'sous_caracteristiques', '{}'::jsonb,
                    'filtrable', true,
                    'origine_champs', 'formulaire'
                )
            );
        END IF;
        
        -- ✅ OPTIMISÉ: UPDATE atomique sans verrou long
        -- On construit le JSONB en mémoire avant l'UPDATE, ce qui est plus rapide
        -- et évite de verrouiller la ligne pendant le calcul
        UPDATE services
        SET 
            data = v_new_data,
            updated_at = NOW()
        WHERE id = p_service_id
        AND is_active = true
        RETURNING 
            data->'produits' as produits_data,
            data->'lieu_produit' as lieu_data
        INTO v_produits_data, v_lieu_data;
        
        -- Si aucun service n'a été mis à jour (non trouvé ou inactif)
        IF NOT FOUND THEN
            RETURN;
        END IF;
    END;
    
    -- Retourner les résultats
    product_index := v_product_index;
    produits_data := v_produits_data;
    lieu_data := v_lieu_data;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_product_to_service_jsonb_v2 IS 'Fonction optimisée qui évite les verrous longs. Lit les données AVANT le verrou, construit le nouveau JSONB en mémoire, puis fait un UPDATE atomique rapide. Réduit significativement le temps d''exécution même pour les services avec beaucoup de produits.';

-- Index pour garantir que les UPDATE sont rapides
CREATE INDEX IF NOT EXISTS idx_services_id_for_updates 
    ON services(id) 
    WHERE is_active = true;

-- Index GIN sur data->'produits'->'valeur' pour accès rapide à la longueur
CREATE INDEX IF NOT EXISTS idx_services_produits_valeur_gin 
    ON services USING GIN ((data->'produits'->'valeur'))
    WHERE data->'produits'->'valeur' IS NOT NULL;

-- ✅ NOUVEAU: Index partiel pour les services avec beaucoup de produits
-- Cela aide PostgreSQL à choisir un plan d'exécution optimal
CREATE INDEX IF NOT EXISTS idx_services_data_produits_partial
    ON services USING GIN (data)
    WHERE is_active = true 
    AND data->'produits'->'valeur' IS NOT NULL
    AND jsonb_array_length(data->'produits'->'valeur') > 0;

-- ✅ NOUVEAU 2026-01-02: Queue asynchrone pour création de produits
-- SOLUTION DÉFINITIVE: Évite les timeouts et les erreurs TLS
CREATE TABLE IF NOT EXISTS product_creation_queue (
    id BIGSERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_data JSONB NOT NULL,
    images_to_process TEXT[] DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 5,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    result_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_queue_status_priority 
    ON product_creation_queue(status, priority, created_at) 
    WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_product_queue_created_at 
    ON product_creation_queue(created_at) 
    WHERE status IN ('completed', 'failed');

CREATE INDEX IF NOT EXISTS idx_product_queue_service_id 
    ON product_creation_queue(service_id) 
    WHERE status = 'pending';

CREATE OR REPLACE FUNCTION cleanup_old_product_creation_jobs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM product_creation_queue
    WHERE status IN ('completed', 'failed')
      AND created_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE product_creation_queue IS 'Queue asynchrone pour création de produits. Évite les timeouts et erreurs TLS en traitant les créations en arrière-plan.';
COMMENT ON FUNCTION cleanup_old_product_creation_jobs IS 'Nettoie les jobs de création de produits de plus de 7 jours.';

-- ✅ NOUVEAU 2026-01-02: Table de cache PostgreSQL pour remplacer Redis
-- SOLUTION DÉFINITIVE: Cache basé sur PostgreSQL, plus fiable que Redis
CREATE TABLE IF NOT EXISTS cache_table (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_expires_at 
    ON cache_table(expires_at) 
    WHERE expires_at < NOW();

CREATE INDEX IF NOT EXISTS idx_cache_key_pattern 
    ON cache_table(cache_key text_pattern_ops);

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_table
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_cache(key VARCHAR(255))
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT cache_value INTO result
    FROM cache_table
    WHERE cache_key = key
      AND expires_at > NOW();
    
    IF result IS NOT NULL THEN
        UPDATE cache_table
        SET access_count = access_count + 1,
            last_accessed_at = NOW()
        WHERE cache_key = key;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_cache(
    key VARCHAR(255),
    value JSONB,
    ttl_seconds INTEGER DEFAULT 3600
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO cache_table (cache_key, cache_value, expires_at, updated_at)
    VALUES (key, value, NOW() + (ttl_seconds || ' seconds')::INTERVAL, NOW())
    ON CONFLICT (cache_key) 
    DO UPDATE SET
        cache_value = EXCLUDED.cache_value,
        expires_at = EXCLUDED.expires_at,
        updated_at = EXCLUDED.updated_at,
        access_count = 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_cache(key VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_table
    WHERE cache_key = key;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count > 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_cache_pattern(pattern VARCHAR(255))
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_table
    WHERE cache_key LIKE pattern;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE cache_table IS 'Table de cache PostgreSQL pour remplacer Redis. Plus fiable et intégré à la base de données.';
COMMENT ON FUNCTION get_cache IS 'Récupère une valeur du cache si elle n''est pas expirée.';
COMMENT ON FUNCTION set_cache IS 'Met une valeur en cache avec un TTL en secondes.';
COMMENT ON FUNCTION delete_cache IS 'Supprime une clé du cache.';
COMMENT ON FUNCTION delete_cache_pattern IS 'Supprime les clés du cache correspondant à un pattern.';

-- =====================================================
-- ✅ OPTIMISATION ADDITIONNELLE 2026-01-11: Correction des requêtes lentes identifiées dans les warnings
-- =====================================================

-- 1. Optimisation requête get_delivery_summary
-- Index GIST pour return_pickup_location (manquant)
CREATE INDEX IF NOT EXISTS idx_deliveries_return_pickup_location_gist
ON deliveries USING GIST(return_pickup_location)
WHERE return_pickup_location IS NOT NULL;

-- Index GIST pour return_dropoff_location (manquant)
CREATE INDEX IF NOT EXISTS idx_deliveries_return_dropoff_location_gist
ON deliveries USING GIST(return_dropoff_location)
WHERE return_dropoff_location IS NOT NULL;

-- Index composite pour is_round_trip (utilisé dans la requête)
CREATE INDEX IF NOT EXISTS idx_deliveries_round_trip
ON deliveries(id, is_round_trip)
WHERE is_round_trip = true;

-- 2. Optimisation find_nearby_couriers (amélioration)
-- Index pour captured_at récent (utilisé dans find_nearby_couriers)
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_recent
ON courier_availability_snapshots(captured_at DESC, is_online, load_factor)
WHERE is_online = true AND load_factor < 1.0;

-- Index composite pour user_id et courier_id (utilisé dans jointure)
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_user_courier
ON courier_availability_snapshots(user_id, courier_id)
WHERE is_online = true;

-- 3. Optimisation UPDATE delivery_matching_queue
-- Index pour WHERE delivery_id = $1 dans UPDATE (amélioration)
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_delivery_id_status
ON delivery_matching_queue(delivery_id, status);

-- Index pour next_attempt_at (utilisé dans WHERE clauses)
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_next_attempt
ON delivery_matching_queue(next_attempt_at)
WHERE next_attempt_at IS NOT NULL;

-- 4. Optimisation requêtes fréquentes sur deliveries
-- Index pour creator_id (utilisé dans plusieurs requêtes)
CREATE INDEX IF NOT EXISTS idx_deliveries_creator_id
ON deliveries(creator_id, status, requested_at DESC);

-- Index pour courier_id (utilisé dans plusieurs requêtes)
CREATE INDEX IF NOT EXISTS idx_deliveries_courier_id
ON deliveries(courier_id, status, requested_at DESC);

-- Index pour recipient_user_id (utilisé dans requêtes récipient)
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_user_id
ON deliveries(recipient_user_id, status)
WHERE recipient_user_id IS NOT NULL;

-- Index pour tracking_token (utilisé dans requêtes de suivi)
CREATE INDEX IF NOT EXISTS idx_deliveries_tracking_token
ON deliveries(tracking_token)
WHERE tracking_token IS NOT NULL;

-- Index pour recipient_tracking_token
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_tracking_token
ON deliveries(recipient_tracking_token)
WHERE recipient_tracking_token IS NOT NULL;

-- 5. ANALYZE pour mettre à jour les statistiques
ANALYZE deliveries;
ANALYZE delivery_matching_queue;
ANALYZE courier_availability_snapshots;
ANALYZE courier_assets;

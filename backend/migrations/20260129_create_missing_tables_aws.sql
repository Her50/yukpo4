-- Migration: Création de toutes les tables manquantes pour AWS
-- Date: 2026-01-29
-- Description: Ce script crée toutes les tables critiques manquantes dans AWS
--              en respectant l'ordre des dépendances

-- ============================================================================
-- PARTIE 1: Vérification et création des types ENUM nécessaires
-- ============================================================================

-- Type pour le statut des livraisons
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
        CREATE TYPE delivery_status AS ENUM (
            'requested', 'confirmed', 'accepted', 'picked_up', 
            'in_transit', 'delivered', 'completed', 'cancelled'
        );
    END IF;
END $$;

-- Type pour les raisons d'annulation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_cancel_reason') THEN
        CREATE TYPE delivery_cancel_reason AS ENUM (
            'client_cancelled', 'courier_cancelled', 'timeout', 
            'unavailable', 'other'
        );
    END IF;
END $$;

-- Type pour le statut des coursiers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_courier_status') THEN
        CREATE TYPE delivery_courier_status AS ENUM (
            'pending_review', 'active', 'suspended', 'inactive'
        );
    END IF;
END $$;

-- Type pour le statut du matching
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_matching_status') THEN
        CREATE TYPE delivery_matching_status AS ENUM (
            'queued', 'searching', 'assigned', 'rejected', 
            'failed', 'timeout', 'cancelled', 'fallback', 'no_courier'
        );
    END IF;
END $$;

-- ============================================================================
-- PARTIE 2: Tables de base CRITIQUES (users, services) - DOIT être créé en premier
-- ============================================================================

-- Table users (CRITIQUE - doit être créée en premier)
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
    groupe_sanguin VARCHAR(5) CHECK (groupe_sanguin IS NULL OR groupe_sanguin IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_provider ON users(is_provider);

-- Table services (CRITIQUE - doit être créée en deuxième)
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category_id INTEGER,
    price_cfa NUMERIC(14,2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_services_category_id ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);

-- Table media (CRITIQUE - nécessaire pour social_publication_jobs)
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'media_type_check' AND table_name = 'media'
    ) THEN
        ALTER TABLE media ADD CONSTRAINT media_type_check CHECK (media_type IN ('image', 'video', 'audio'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_media_service_id ON media(service_id);
CREATE INDEX IF NOT EXISTS idx_media_product_id ON media(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type);
CREATE INDEX IF NOT EXISTS idx_media_is_main_image ON media(is_main_image) WHERE is_main_image = TRUE;

-- ============================================================================
-- PARTIE 3: Tables de dépendance (si elles n'existent pas)
-- ============================================================================

-- Table parcel_types (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS parcel_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    max_weight_kg NUMERIC(6,2),
    max_volume_cm3 NUMERIC(12,2),
    icon_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table live_sessions (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    title TEXT,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    scheduled_start_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    viewer_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_host ON live_sessions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);

-- Table couriers (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS couriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status delivery_courier_status NOT NULL DEFAULT 'pending_review',
    rating_average NUMERIC(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    bio TEXT,
    hired_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_couriers_user_id ON couriers(user_id);
CREATE INDEX IF NOT EXISTS idx_couriers_status ON couriers(status);

-- Table delivery_parcels (si elle n'existe pas)
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

-- Table delivery_zones (si elle n'existe pas)
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

-- ============================================================================
-- PARTIE 3: Tables principales manquantes
-- ============================================================================

-- Table deliveries
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
    distance_meters INTEGER,
    estimated_duration_seconds INTEGER,
    actual_duration_seconds INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now(),
    pricing_id UUID,
    tracking_token UUID UNIQUE DEFAULT gen_random_uuid(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_deliveries_status_requested_at ON deliveries (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries (courier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_creator ON deliveries (creator_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_location ON deliveries USING GIST (pickup_location);
CREATE INDEX IF NOT EXISTS idx_deliveries_dropoff_location ON deliveries USING GIST (dropoff_location);

-- Table delivery_matching_queue
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

-- Table delivery_proximity_suggestions
CREATE TABLE IF NOT EXISTS delivery_proximity_suggestions (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    suggested_status delivery_status NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    auto_confirm_after_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_delivery ON delivery_proximity_suggestions(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_status ON delivery_proximity_suggestions(status, created_at);

-- Table live_flash_sales
CREATE TABLE IF NOT EXISTS live_flash_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX IF NOT EXISTS idx_live_flash_sales_session ON live_flash_sales(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status ON live_flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_timing ON live_flash_sales(start_at, end_at);

-- Table global_promo_events
CREATE TABLE IF NOT EXISTS global_promo_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX IF NOT EXISTS idx_global_promo_events_status ON global_promo_events(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_global_promo_events_theme ON global_promo_events(theme);

-- Table social_publication_jobs
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

CREATE INDEX IF NOT EXISTS idx_social_publication_jobs_status ON social_publication_jobs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_social_publication_jobs_media ON social_publication_jobs(media_id);

-- Table video_generation_jobs
CREATE TABLE IF NOT EXISTS video_generation_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    job_type VARCHAR(50),
    input_data JSONB,
    output_url TEXT,
    error_message TEXT,
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status ON video_generation_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_user ON video_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_service ON video_generation_jobs(service_id);

-- Table product_creation_queue
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

CREATE INDEX IF NOT EXISTS idx_product_queue_status_priority ON product_creation_queue(status, priority, created_at) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_product_queue_created_at ON product_creation_queue(created_at) WHERE status IN ('completed', 'failed');
CREATE INDEX IF NOT EXISTS idx_product_queue_service_id ON product_creation_queue(service_id) WHERE status = 'pending';

-- Table product_orders (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS product_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id),
    product_index INTEGER NOT NULL,
    client_user_id INTEGER NOT NULL REFERENCES users(id),
    provider_user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    preparation_time_minutes INTEGER,
    estimated_ready_at TIMESTAMPTZ,
    validated_at TIMESTAMPTZ,
    validated_by INTEGER REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    validation_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_product_orders_status ON product_orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_product_orders_provider ON product_orders(provider_user_id, status);
CREATE INDEX IF NOT EXISTS idx_product_orders_delivery ON product_orders(delivery_id) WHERE delivery_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_orders_estimated_ready ON product_orders(estimated_ready_at) WHERE estimated_ready_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_orders_validation_deadline ON product_orders(validation_deadline) WHERE status = 'pending' AND validation_deadline IS NOT NULL;

-- Table service_products (CRITIQUE - produits de services)
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
            THEN CAST((product_data->'prix'->'valeur'->>'montant') AS NUMERIC)
            WHEN product_data->'prix'->>'montant' IS NOT NULL 
            THEN CAST((product_data->'prix'->>'montant') AS NUMERIC)
            WHEN product_data->>'prix' IS NOT NULL 
            THEN CAST((product_data->>'prix') AS NUMERIC)
            ELSE NULL
        END
    ) STORED,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ,
    
    UNIQUE(service_id, product_index)
);

CREATE INDEX IF NOT EXISTS idx_service_products_service_id ON service_products(service_id);
CREATE INDEX IF NOT EXISTS idx_service_products_active ON service_products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_service_products_type ON service_products(product_type);
CREATE INDEX IF NOT EXISTS idx_service_products_name_gin ON service_products USING GIN(to_tsvector('french', product_name));
CREATE INDEX IF NOT EXISTS idx_service_products_data_gin ON service_products USING GIN(product_data);
CREATE INDEX IF NOT EXISTS idx_service_products_service_index ON service_products(service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_service_products_created_at ON service_products(created_at DESC);

-- Trigger pour updated_at
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

CREATE INDEX IF NOT EXISTS idx_publicites_user_id ON publicites(user_id);
CREATE INDEX IF NOT EXISTS idx_publicites_status ON publicites(status);
CREATE INDEX IF NOT EXISTS idx_publicites_zone ON publicites(zone_geographique);
CREATE INDEX IF NOT EXISTS idx_publicites_date_fin ON publicites(date_fin);
CREATE INDEX IF NOT EXISTS idx_publicites_produits_gin ON publicites USING GIN(produits_indexes);
CREATE INDEX IF NOT EXISTS idx_publicites_targeting_gin ON publicites USING GIN(targeting);
CREATE INDEX IF NOT EXISTS idx_publicites_ab_testing_gin ON publicites USING GIN(ab_testing);
CREATE INDEX IF NOT EXISTS idx_publicites_placements_gin ON publicites USING GIN(placements);
CREATE INDEX IF NOT EXISTS idx_publicites_retargeting_gin ON publicites USING GIN(retargeting);

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

-- Table offres_emploi (nécessaire pour matching_offres_candidats)
CREATE TABLE IF NOT EXISTS offres_emploi (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    titre_poste VARCHAR(255) NOT NULL,
    description TEXT,
    secteur VARCHAR(100),
    type_contrat TEXT[],
    salaire_min DECIMAL(10, 2),
    salaire_max DECIMAL(10, 2),
    lieu_travail VARCHAR(255),
    remote BOOLEAN DEFAULT FALSE,
    competences_requises TEXT[],
    experience_requise INTEGER,
    niveau_etude VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft', 'expired')),
    date_publication TIMESTAMPTZ DEFAULT NOW(),
    date_expiration TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offres_emploi_user_id ON offres_emploi(user_id);
CREATE INDEX IF NOT EXISTS idx_offres_emploi_status ON offres_emploi(status);
CREATE INDEX IF NOT EXISTS idx_offres_emploi_secteur ON offres_emploi(secteur);
CREATE INDEX IF NOT EXISTS idx_offres_emploi_competences_gin ON offres_emploi USING GIN(competences_requises);

-- Table matching_offres_candidats
CREATE TABLE IF NOT EXISTS matching_offres_candidats (
    id SERIAL PRIMARY KEY,
    offre_id INTEGER NOT NULL REFERENCES offres_emploi(id) ON DELETE CASCADE,
    candidat_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Score de matching
    score_total DECIMAL(5, 2) NOT NULL,
    score_competences DECIMAL(5, 2),
    score_experience DECIMAL(5, 2),
    score_localisation DECIMAL(5, 2),
    score_salaire DECIMAL(5, 2),
    
    -- Détails matching
    competences_match TEXT[],
    competences_manquantes TEXT[],
    criteres_match JSONB,
    
    -- Métadonnées
    date_calcul TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_notified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_matching UNIQUE (offre_id, candidat_id)
);

CREATE INDEX IF NOT EXISTS idx_matching_offre ON matching_offres_candidats(offre_id, score_total DESC);
CREATE INDEX IF NOT EXISTS idx_matching_candidat ON matching_offres_candidats(candidat_id, score_total DESC);
CREATE INDEX IF NOT EXISTS idx_matching_score ON matching_offres_candidats(score_total DESC) WHERE score_total >= 70;
CREATE INDEX IF NOT EXISTS idx_matching_notified ON matching_offres_candidats(is_notified, date_calcul) WHERE is_notified = false;

-- ============================================================================
-- PARTIE 4: Fonctions utilitaires
-- ============================================================================

-- Fonction de nettoyage pour product_creation_queue
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

-- ============================================================================
-- PARTIE 5: Commentaires
-- ============================================================================

COMMENT ON TABLE deliveries IS 'Table principale des livraisons';
COMMENT ON TABLE delivery_matching_queue IS 'File d''attente pour le matching des coursiers';
COMMENT ON TABLE delivery_proximity_suggestions IS 'Suggestions de proximité pour les livraisons';
COMMENT ON TABLE live_flash_sales IS 'Flash sales en direct';
COMMENT ON TABLE global_promo_events IS 'Événements promotionnels globaux';
COMMENT ON TABLE social_publication_jobs IS 'Jobs de publication sur les réseaux sociaux';
COMMENT ON TABLE video_generation_jobs IS 'Jobs de génération de vidéos';
COMMENT ON TABLE product_creation_queue IS 'Queue asynchrone pour création de produits';
COMMENT ON TABLE product_orders IS 'Commandes de produits';


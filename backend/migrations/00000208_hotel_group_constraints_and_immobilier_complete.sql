-- Migration: 2026-04-01
-- Ajout contraintes manquantes + tables complémentaires immobilier
-- Purpose: Digitalisation complète services spécialisés immobilier

-- ============================================================
-- 1. Contrainte UNIQUE user_id sur hotel_client_profiles
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'hotel_client_profiles_user_id_unique'
    ) THEN
        ALTER TABLE hotel_client_profiles
        ADD CONSTRAINT hotel_client_profiles_user_id_unique UNIQUE (user_id);
    END IF;
END $$;

-- ============================================================
-- 2. land_properties : schéma déjà complet (user_id, is_active, etc.)
--    Ajout de colonnes optionnelles manquantes seulement
-- ============================================================
DO $$
BEGIN
    -- prix_m2 calculé automatiquement (peut être absent dans certaines installations)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='land_properties' AND column_name='prix_m2') THEN
        ALTER TABLE land_properties ADD COLUMN prix_m2 DECIMAL(10,2);
    END IF;
END $$;

-- ============================================================
-- 3. Table decorator_profiles (partenaires décoration)
-- ============================================================
CREATE TABLE IF NOT EXISTS decorator_profiles (
    id                  SERIAL PRIMARY KEY,
    service_id          INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom_entreprise      VARCHAR(255) NOT NULL,
    description         TEXT,
    styles              TEXT[],       -- ["Moderne", "Africain", "Scandinave", ...]
    specialites         TEXT[],       -- ["Résidentiel", "Commercial", "Hôtellerie", ...]
    tarif_consultation  DECIMAL(12,2),
    tarif_journalier    DECIMAL(12,2),
    portfolio_urls      TEXT[],
    logo_url            TEXT,
    telephone           VARCHAR(50),
    whatsapp            VARCHAR(50),
    email               VARCHAR(255),
    ville               VARCHAR(100),
    quartier            VARCHAR(255),
    gps                 VARCHAR(100),
    annees_experience   INTEGER DEFAULT 0,
    nb_projets_realises INTEGER DEFAULT 0,
    note_moyenne        DECIMAL(3,2) DEFAULT 0.0,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_decorator_service UNIQUE (service_id)
);

CREATE INDEX IF NOT EXISTS idx_decorator_profiles_user ON decorator_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_decorator_profiles_active ON decorator_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_decorator_profiles_ville ON decorator_profiles(ville);

-- ============================================================
-- 4. Table decoration_consultation_requests (demandes client)
-- ============================================================
CREATE TABLE IF NOT EXISTS decoration_consultation_requests (
    id                  SERIAL PRIMARY KEY,
    decorator_id        INTEGER NOT NULL REFERENCES decorator_profiles(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_consultation   VARCHAR(50) NOT NULL DEFAULT 'physique', -- "physique","video","chat"
    date_souhaitee      TIMESTAMPTZ NOT NULL,
    duree_minutes       INTEGER DEFAULT 60,
    sujet               TEXT NOT NULL,
    description         TEXT,
    budget_estime       DECIMAL(12,2),
    adresse_projet      TEXT,
    ville_projet        VARCHAR(100),
    photos_projet       TEXT[],
    status              VARCHAR(50) NOT NULL DEFAULT 'pending',
        -- pending | confirmed | completed | cancelled | rejected
    notes_partenaire    TEXT,
    montant             DECIMAL(12,2),
    payment_status      VARCHAR(50) DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deco_consult_decorator ON decoration_consultation_requests(decorator_id);
CREATE INDEX IF NOT EXISTS idx_deco_consult_user ON decoration_consultation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deco_consult_status ON decoration_consultation_requests(status);
CREATE INDEX IF NOT EXISTS idx_deco_consult_date ON decoration_consultation_requests(date_souhaitee);

-- ============================================================
-- 5. Déménagement — colonne partenaire pour moving_bookings
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='moving_bookings' AND column_name='confirmed_at') THEN
        ALTER TABLE moving_bookings ADD COLUMN confirmed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='moving_bookings' AND column_name='completed_at') THEN
        ALTER TABLE moving_bookings ADD COLUMN completed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='moving_bookings' AND column_name='cancelled_at') THEN
        ALTER TABLE moving_bookings ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='moving_bookings' AND column_name='cancellation_reason') THEN
        ALTER TABLE moving_bookings ADD COLUMN cancellation_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='moving_bookings' AND column_name='partner_notes') THEN
        ALTER TABLE moving_bookings ADD COLUMN partner_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='moving_bookings' AND column_name='gps_current') THEN
        ALTER TABLE moving_bookings ADD COLUMN gps_current VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='moving_bookings' AND column_name='eta_minutes') THEN
        ALTER TABLE moving_bookings ADD COLUMN eta_minutes INTEGER;
    END IF;
END $$;

-- ============================================================
-- 6. moving_tracking — colonne GPS temps réel
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='moving_tracking' AND column_name='gps_lat') THEN
        ALTER TABLE moving_tracking ADD COLUMN gps_lat DECIMAL(10,7);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='moving_tracking' AND column_name='gps_lng') THEN
        ALTER TABLE moving_tracking ADD COLUMN gps_lng DECIMAL(10,7);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='moving_tracking' AND column_name='etape') THEN
        ALTER TABLE moving_tracking ADD COLUMN etape VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='moving_tracking' AND column_name='message_partenaire') THEN
        ALTER TABLE moving_tracking ADD COLUMN message_partenaire TEXT;
    END IF;
END $$;

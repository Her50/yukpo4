-- Migration: Create all missing hotel/meublé tables and align hotel_meuble_reservations
-- Date: 2026-03-17
-- Purpose: Fix critical schema gaps for hotel/meublé service

-- ============================================================
-- 1. hotel_meuble_units (chambres/unités)
-- ============================================================
CREATE TABLE IF NOT EXISTS hotel_meuble_units (
    id              SERIAL PRIMARY KEY,
    property_id     INTEGER NOT NULL,
    unit_number     VARCHAR(50) NOT NULL,
    unit_type       VARCHAR(50) NOT NULL DEFAULT 'chambre',
    standing        VARCHAR(50) DEFAULT 'standard',
    capacite_max_adultes  INTEGER NOT NULL DEFAULT 2,
    capacite_max_enfants  INTEGER DEFAULT 0,
    capacite_max_total    INTEGER NOT NULL DEFAULT 2,
    superficie_m2   DECIMAL(10,2),
    equipements     JSONB NOT NULL DEFAULT '{}',
    photos          TEXT[],
    prix_nuitee     DECIMAL(12,2),
    prix_heure      DECIMAL(12,2),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_available    BOOLEAN NOT NULL DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_meuble_units_property ON hotel_meuble_units(property_id);
CREATE INDEX IF NOT EXISTS idx_hotel_meuble_units_active ON hotel_meuble_units(property_id, is_active);
CREATE INDEX IF NOT EXISTS idx_hotel_meuble_units_available ON hotel_meuble_units(property_id, is_available);

-- ============================================================
-- 2. hotel_unit_blockages (blocages manuels)
-- ============================================================
CREATE TABLE IF NOT EXISTS hotel_unit_blockages (
    id                   SERIAL PRIMARY KEY,
    unit_id              INTEGER NOT NULL,
    property_id          INTEGER NOT NULL,
    date_debut           DATE NOT NULL,
    date_fin             DATE NOT NULL,
    heure_debut          TIME,
    heure_fin            TIME,
    raison               VARCHAR(100) NOT NULL DEFAULT 'maintenance',
    description          TEXT,
    is_manual_occupation BOOLEAN NOT NULL DEFAULT FALSE,
    client_name          VARCHAR(255),
    client_phone         VARCHAR(50),
    notes_occupation     TEXT,
    created_by           INTEGER,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_unit_blockages_unit ON hotel_unit_blockages(unit_id);
CREATE INDEX IF NOT EXISTS idx_hotel_unit_blockages_property ON hotel_unit_blockages(property_id);
CREATE INDEX IF NOT EXISTS idx_hotel_unit_blockages_dates ON hotel_unit_blockages(date_debut, date_fin);

-- ============================================================
-- 3. hotel_property_groups (groupes multi-biens)
-- ============================================================
CREATE TABLE IF NOT EXISTS hotel_property_groups (
    id              SERIAL PRIMARY KEY,
    partner_id      INTEGER NOT NULL,
    group_name      VARCHAR(255) NOT NULL,
    description     TEXT,
    logo_url        TEXT,
    company_name    VARCHAR(255),
    tax_id          VARCHAR(100),
    address         TEXT,
    phone           VARCHAR(50),
    email           VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_property_groups_partner ON hotel_property_groups(partner_id);

-- ============================================================
-- 4. hotel_property_group_members
-- ============================================================
CREATE TABLE IF NOT EXISTS hotel_property_group_members (
    id              SERIAL PRIMARY KEY,
    group_id        INTEGER NOT NULL,
    property_id     INTEGER NOT NULL,
    location_name   VARCHAR(255),
    location_address TEXT,
    location_gps    VARCHAR(100),
    display_order   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_property_group_members_group ON hotel_property_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_hotel_property_group_members_property ON hotel_property_group_members(property_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hotel_property_group_members_unique ON hotel_property_group_members(group_id, property_id);

-- ============================================================
-- 5. hotel_client_form_configs (formulaires personnalisés)
-- ============================================================
CREATE TABLE IF NOT EXISTS hotel_client_form_configs (
    id              SERIAL PRIMARY KEY,
    property_id     INTEGER,
    group_id        INTEGER,
    form_fields     JSONB NOT NULL DEFAULT '[]',
    required_fields TEXT[],
    default_values  JSONB NOT NULL DEFAULT '{}',
    logo_url        TEXT,
    header_text     TEXT,
    footer_text     TEXT,
    company_info    JSONB NOT NULL DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_client_form_configs_property ON hotel_client_form_configs(property_id);
CREATE INDEX IF NOT EXISTS idx_hotel_client_form_configs_group ON hotel_client_form_configs(group_id);

-- ============================================================
-- 6. hotel_client_profiles (profils clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS hotel_client_profiles (
    id                      SERIAL PRIMARY KEY,
    user_id                 INTEGER NOT NULL,
    nom_complet             VARCHAR(255),
    prenom                  VARCHAR(100),
    nom_famille             VARCHAR(100),
    date_naissance          DATE,
    lieu_naissance          VARCHAR(255),
    nationalite             VARCHAR(100),
    type_piece_identite     VARCHAR(50),
    numero_piece_identite   VARCHAR(100),
    date_expiration_piece   DATE,
    telephone               VARCHAR(50),
    email                   VARCHAR(255),
    adresse                 TEXT,
    ville                   VARCHAR(100),
    pays                    VARCHAR(100),
    preferences             JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_client_profiles_user ON hotel_client_profiles(user_id);

-- ============================================================
-- 7. Align hotel_meuble_reservations with Rust code
--    Add all missing columns the code expects
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='property_id') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN property_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='unit_id') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN unit_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='unit_number') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN unit_number VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='date_arrivee') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN date_arrivee DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='date_depart') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN date_depart DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='nombre_adultes') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN nombre_adultes INTEGER NOT NULL DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='nombre_enfants') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN nombre_enfants INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='nombre_chambres') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN nombre_chambres INTEGER NOT NULL DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='nom_client') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN nom_client VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='telephone_client') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN telephone_client VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='email_client') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN email_client VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='prix_nuitee') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN prix_nuitee DECIMAL(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='prix_total') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN prix_total DECIMAL(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='montant_total') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN montant_total DECIMAL(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='montant_avance') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN montant_avance DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='payment_status') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='payment_method') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN payment_method VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='is_manual_reservation') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN is_manual_reservation BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='manual_reservation_source') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN manual_reservation_source VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='manual_reservation_notes') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN manual_reservation_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='qr_code') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN qr_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='qr_code_expires_at') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN qr_code_expires_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='created_by') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN created_by INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='cancelled_at') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='cancelled_by') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN cancelled_by INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='cancellation_reason') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN cancellation_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='penalty_rate') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN penalty_rate DOUBLE PRECISION DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='penalty_amount') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN penalty_amount DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_meuble_reservations' AND column_name='refund_amount') THEN
        ALTER TABLE hotel_meuble_reservations ADD COLUMN refund_amount DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;

-- Additional indexes for hotel_meuble_reservations
CREATE INDEX IF NOT EXISTS idx_hotel_meuble_reservations_property ON hotel_meuble_reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_hotel_meuble_reservations_unit ON hotel_meuble_reservations(unit_id);
CREATE INDEX IF NOT EXISTS idx_hotel_meuble_reservations_qr_code ON hotel_meuble_reservations(qr_code);
CREATE INDEX IF NOT EXISTS idx_hotel_meuble_reservations_date_arrivee ON hotel_meuble_reservations(date_arrivee);
CREATE INDEX IF NOT EXISTS idx_hotel_meuble_reservations_payment_status ON hotel_meuble_reservations(payment_status);
CREATE INDEX IF NOT EXISTS idx_hotel_meuble_reservations_created_by ON hotel_meuble_reservations(created_by);

-- ============================================================
-- 8. Performance indexes for immobilier search
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_real_estate_properties_type_bien ON real_estate_properties(type_bien);
CREATE INDEX IF NOT EXISTS idx_real_estate_properties_ville ON real_estate_properties(ville);
CREATE INDEX IF NOT EXISTS idx_real_estate_properties_standing ON real_estate_properties(standing);
CREATE INDEX IF NOT EXISTS idx_real_estate_properties_ville_type ON real_estate_properties(ville, type_bien);

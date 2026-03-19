-- Migration: Création des tables couriers et courier_assets
-- Date: 2025-11-10

-- ✅ CORRIGÉ 2026-01-29: Vérifier et créer les types ENUM si nécessaire
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_courier_status') THEN
        CREATE TYPE delivery_courier_status AS ENUM (
            'pending_review',
            'approved',
            'rejected',
            'suspended'
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_engine_type') THEN
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
    END IF;
END $$;

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

CREATE INDEX IF NOT EXISTS idx_courier_assets_courier ON courier_assets (courier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_assets_primary ON courier_assets (courier_id) WHERE is_primary = TRUE;


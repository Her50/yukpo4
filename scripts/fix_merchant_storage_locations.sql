-- ========================================
-- CORRECTION CRITIQUE: Créer merchant_storage_locations AVANT migration 0
-- Date: 2026-02-13
-- Problème: Migration 0 référence cette table mais ne la crée pas
-- ========================================

-- ✅ CRITIQUE: Créer merchant_storage_locations EN PREMIER
-- Cette table est référencée dans 0000_create_all_tables.sql ligne 2881
-- mais n'est jamais créée dans cette migration

-- Note: Si la table users n'existe pas encore, on crée sans FK d'abord
-- La FK sera ajoutée après la création de users

DO $$
BEGIN
    -- Créer la table si elle n'existe pas
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'merchant_storage_locations'
    ) THEN
        -- Vérifier si users existe pour décider de créer avec ou sans FK
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
        ) THEN
            -- Créer avec FK vers users
            CREATE TABLE merchant_storage_locations (
                id SERIAL PRIMARY KEY,
                merchant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                address TEXT,
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                location GEOGRAPHY(Point, 4326),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                capacity_info JSONB DEFAULT '{}'::jsonb,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        ELSE
            -- Créer sans FK (sera ajoutée après création de users)
            CREATE TABLE merchant_storage_locations (
                id SERIAL PRIMARY KEY,
                merchant_id INTEGER,
                name TEXT NOT NULL,
                address TEXT,
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                location GEOGRAPHY(Point, 4326),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                capacity_info JSONB DEFAULT '{}'::jsonb,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        END IF;
        
        RAISE NOTICE '✅ Table merchant_storage_locations créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table merchant_storage_locations existe déjà';
    END IF;
END $$;

-- Index pour merchant_storage_locations
CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_merchant 
    ON merchant_storage_locations(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_active 
    ON merchant_storage_locations(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_location 
    ON merchant_storage_locations USING GIST (location);

-- Ajouter la FK si elle n'existe pas et si users existe
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) THEN
        -- Vérifier si la FK existe déjà
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'merchant_storage_locations_merchant_id_fkey'
            AND table_name = 'merchant_storage_locations'
        ) THEN
            -- Ajouter la FK
            ALTER TABLE merchant_storage_locations 
            ADD CONSTRAINT merchant_storage_locations_merchant_id_fkey 
            FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE;
            
            RAISE NOTICE '✅ FK merchant_id -> users(id) ajoutée';
        ELSE
            RAISE NOTICE 'ℹ️ FK merchant_id -> users(id) existe déjà';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ Table users n''existe pas encore, FK sera ajoutée après création de users';
    END IF;
END $$;

-- ✅ Maintenant, la migration 0 pourra référencer cette table sans erreur


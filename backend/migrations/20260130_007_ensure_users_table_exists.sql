-- Migration CRITIQUE: Garantir que la table users existe
-- Date: 2026-01-30
-- Description: Crée explicitement la table users si elle n'existe pas
--              Cette migration s'exécute AVANT la migration 0 pour garantir que users existe
-- =====================================================

-- =====================================================
-- CRITIQUE: Créer la table users si elle n'existe pas
-- =====================================================
-- Problème: La migration 0 peut échouer avant d'arriver à CREATE TABLE users
-- Solution: Créer users explicitement AVANT la migration 0
DO $$
BEGIN
    -- Vérifier si la table users existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) THEN
        RAISE NOTICE '🔧 Création de la table users...';
        
        -- Créer la table users avec toutes les colonnes nécessaires
        CREATE TABLE users (
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
            token_price_user DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            token_price_provider DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            commission_pct REAL NOT NULL DEFAULT 0.0,
            preferred_lang TEXT NOT NULL DEFAULT 'fr',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            gps VARCHAR(255),
            gps_consent BOOLEAN DEFAULT TRUE,
            groupe_sanguin VARCHAR(5) CHECK (groupe_sanguin IS NULL OR groupe_sanguin IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
            partner_type TEXT,
            partner_status TEXT
        );
        
        -- Définir la valeur par défaut pour gps_consent
        ALTER TABLE users ALTER COLUMN gps_consent SET DEFAULT TRUE;
        
        -- Créer les index essentiels
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_partner_type ON users(partner_type) WHERE partner_type IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_users_partner_status ON users(partner_status) WHERE partner_status IS NOT NULL;
        
        RAISE NOTICE '✅ Table users créée avec succès';
    ELSE
        RAISE NOTICE 'ℹ️ Table users existe déjà';
        
        -- Ajouter les colonnes manquantes si elles n'existent pas
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'partner_type'
        ) THEN
            ALTER TABLE users ADD COLUMN partner_type TEXT;
            RAISE NOTICE '✅ Colonne partner_type ajoutée à users';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'partner_status'
        ) THEN
            ALTER TABLE users ADD COLUMN partner_status TEXT;
            RAISE NOTICE '✅ Colonne partner_status ajoutée à users';
        END IF;
        
        -- Créer les index si nécessaire
        CREATE INDEX IF NOT EXISTS idx_users_partner_type ON users(partner_type) WHERE partner_type IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_users_partner_status ON users(partner_status) WHERE partner_status IS NOT NULL;
    END IF;
END $$;


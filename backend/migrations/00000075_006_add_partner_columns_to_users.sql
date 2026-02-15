-- Migration: Ajout colonnes partner_type et partner_status à users
-- Date: 2026-01-30
-- Description: Ajoute les colonnes manquantes pour l'inscription des partenaires
-- =====================================================

-- =====================================================
-- CORRECTION: Colonnes partner_type et partner_status manquantes dans users
-- =====================================================
-- Problème: L'INSERT dans register_user échoue car partner_type et partner_status n'existent pas
-- Solution: Ajouter ces colonnes conditionnellement
DO $$
BEGIN
    -- Ajouter partner_type si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'partner_type'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN partner_type TEXT;
        RAISE NOTICE '✅ Colonne partner_type ajoutée à users';
    END IF;
    
    -- Ajouter partner_status si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'partner_status'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN partner_status TEXT;
        RAISE NOTICE '✅ Colonne partner_status ajoutée à users';
    END IF;
END $$;

-- Index pour recherche rapide par type de partenaire
CREATE INDEX IF NOT EXISTS idx_users_partner_type ON users(partner_type) WHERE partner_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_partner_status ON users(partner_status) WHERE partner_status IS NOT NULL;


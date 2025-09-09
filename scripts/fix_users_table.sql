-- Script de correction de la table users
-- Ce script ajoute les colonnes manquantes pour corriger l'erreur 500

-- 1. Vérifier d'abord la structure actuelle
DO $$
DECLARE
    col_exists BOOLEAN;
BEGIN
    RAISE NOTICE '🔍 Vérification de la structure de la table users...';
    
    -- Vérifier et ajouter la colonne password_hash si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_hash'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne password_hash...';
        ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '';
    ELSE
        RAISE NOTICE '✅ Colonne password_hash existe déjà';
    END IF;
    
    -- Vérifier et ajouter la colonne is_provider si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_provider'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne is_provider...';
        ALTER TABLE users ADD COLUMN is_provider BOOLEAN NOT NULL DEFAULT false;
    ELSE
        RAISE NOTICE '✅ Colonne is_provider existe déjà';
    END IF;
    
    -- Vérifier et ajouter la colonne tokens_balance si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'tokens_balance'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne tokens_balance...';
        ALTER TABLE users ADD COLUMN tokens_balance BIGINT NOT NULL DEFAULT 2000;
    ELSE
        RAISE NOTICE '✅ Colonne tokens_balance existe déjà';
    END IF;
    
    -- Vérifier et ajouter la colonne token_price_user si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'token_price_user'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne token_price_user...';
        ALTER TABLE users ADD COLUMN token_price_user DOUBLE PRECISION DEFAULT 1.0;
    ELSE
        RAISE NOTICE '✅ Colonne token_price_user existe déjà';
    END IF;
    
    -- Vérifier et ajouter la colonne token_price_provider si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'token_price_provider'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne token_price_provider...';
        ALTER TABLE users ADD COLUMN token_price_provider DOUBLE PRECISION DEFAULT 1.0;
    ELSE
        RAISE NOTICE '✅ Colonne token_price_provider existe déjà';
    END IF;
    
    -- Vérifier et ajouter la colonne commission_pct si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'commission_pct'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne commission_pct...';
        ALTER TABLE users ADD COLUMN commission_pct REAL DEFAULT 0.0;
    ELSE
        RAISE NOTICE '✅ Colonne commission_pct existe déjà';
    END IF;
    
    -- Vérifier et ajouter la colonne preferred_lang si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'preferred_lang'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne preferred_lang...';
        ALTER TABLE users ADD COLUMN preferred_lang VARCHAR(10) DEFAULT 'fr';
    ELSE
        RAISE NOTICE '✅ Colonne preferred_lang existe déjà';
    END IF;
    
    -- Vérifier et ajouter la colonne gps si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'gps'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne gps...';
        ALTER TABLE users ADD COLUMN gps VARCHAR(100);
    ELSE
        RAISE NOTICE '✅ Colonne gps existe déjà';
    END IF;
    
    -- Vérifier et ajouter la colonne gps_consent si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'gps_consent'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne gps_consent...';
        ALTER TABLE users ADD COLUMN gps_consent BOOLEAN NOT NULL DEFAULT true;
    ELSE
        RAISE NOTICE '✅ Colonne gps_consent existe déjà';
    END IF;
    
    -- Vérifier et ajouter la colonne nom si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'nom'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne nom...';
        ALTER TABLE users ADD COLUMN nom VARCHAR(100);
    ELSE
        RAISE NOTICE '✅ Colonne nom existe déjà';
    END IF;
    
    -- Vérifier et ajouter la colonne prenom si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'prenom'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne prenom...';
        ALTER TABLE users ADD COLUMN prenom VARCHAR(100);
    ELSE
        RAISE NOTICE '✅ Colonne prenom existe déjà';
    END IF;
    
    -- Vérifier et ajouter la colonne nom_complet si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'nom_complet'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne nom_complet...';
        ALTER TABLE users ADD COLUMN nom_complet VARCHAR(200);
    ELSE
        RAISE NOTICE '✅ Colonne nom_complet existe déjà';
    END IF;
    
    -- Vérifier et ajouter la colonne photo_profil si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'photo_profil'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne photo_profil...';
        ALTER TABLE users ADD COLUMN photo_profil VARCHAR(500);
    ELSE
        RAISE NOTICE '✅ Colonne photo_profil existe déjà';
    END IF;
    
    -- Vérifier et ajouter la colonne avatar_url si elle n'existe pas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'avatar_url'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne avatar_url...';
        ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);
    ELSE
        RAISE NOTICE '✅ Colonne avatar_url existe déjà';
    END IF;
    
    RAISE NOTICE '✅ Vérification et correction terminées';
END $$;

-- 2. Mettre à jour les valeurs par défaut pour les utilisateurs existants
UPDATE users 
SET 
    password_hash = COALESCE(password_hash, ''),
    is_provider = COALESCE(is_provider, false),
    tokens_balance = COALESCE(tokens_balance, 2000),
    token_price_user = COALESCE(token_price_user, 1.0),
    token_price_provider = COALESCE(token_price_provider, 1.0),
    commission_pct = COALESCE(commission_pct, 0.0),
    preferred_lang = COALESCE(preferred_lang, 'fr'),
    gps_consent = COALESCE(gps_consent, true)
WHERE 
    password_hash IS NULL 
    OR is_provider IS NULL 
    OR tokens_balance IS NULL 
    OR token_price_user IS NULL 
    OR token_price_provider IS NULL 
    OR commission_pct IS NULL 
    OR preferred_lang IS NULL 
    OR gps_consent IS NULL;

-- 3. Vérifier la structure finale
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- 4. Vérifier qu'un utilisateur peut être récupéré
SELECT 
    id,
    email,
    role,
    is_provider,
    tokens_balance,
    token_price_user,
    token_price_provider,
    commission_pct,
    preferred_lang,
    created_at,
    updated_at,
    gps,
    gps_consent,
    nom,
    prenom,
    nom_complet,
    photo_profil,
    avatar_url
FROM users 
LIMIT 1; 
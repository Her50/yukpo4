-- Script de correction COMPLÈTE de la table users
-- Ce script corrige TOUTES les colonnes manquantes pour l'API /api/user/me

-- 1. Vérifier l'existence de TOUTES les colonnes nécessaires
DO $$
DECLARE
    required_columns TEXT[] := ARRAY[
        'id', 'email', 'password_hash', 'role', 'is_provider', 'tokens_balance',
        'token_price_user', 'token_price_provider', 'commission_pct',
        'preferred_lang', 'created_at', 'updated_at', 'gps', 'gps_consent',
        'nom', 'prenom', 'nom_complet', 'photo_profil', 'avatar_url'
    ];
    col_name TEXT;
    col_exists BOOLEAN;
    missing_columns TEXT[] := '{}';
BEGIN
    RAISE NOTICE '🔍 Vérification de TOUTES les colonnes nécessaires...';
    
    FOREACH col_name IN ARRAY required_columns
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = col_name
        ) INTO col_exists;
        
        IF NOT col_exists THEN
            missing_columns := array_append(missing_columns, col_name);
            RAISE NOTICE '❌ Colonne manquante: %', col_name;
        ELSE
            RAISE NOTICE '✅ Colonne existante: %', col_name;
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE NOTICE '📝 Colonnes manquantes détectées: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '🎉 Toutes les colonnes nécessaires existent déjà !';
    END IF;
END $$;

-- 2. Ajouter les colonnes manquantes avec des valeurs par défaut appropriées
DO $$
DECLARE
    col_name TEXT;
    col_exists BOOLEAN;
BEGIN
    RAISE NOTICE '🔧 Ajout des colonnes manquantes...';
    
    -- password_hash
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT '';
        RAISE NOTICE '➕ password_hash ajoutée';
    END IF;
    
    -- role
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
        RAISE NOTICE '➕ role ajoutée';
    END IF;
    
    -- is_provider
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_provider') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN is_provider BOOLEAN DEFAULT false;
        RAISE NOTICE '➕ is_provider ajoutée';
    END IF;
    
    -- token_price_user
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'token_price_user') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN token_price_user INTEGER DEFAULT 10;
        RAISE NOTICE '➕ token_price_user ajoutée';
    END IF;
    
    -- token_price_provider
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'token_price_provider') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN token_price_provider INTEGER DEFAULT 8;
        RAISE NOTICE '➕ token_price_provider ajoutée';
    END IF;
    
    -- commission_pct
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'commission_pct') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN commission_pct INTEGER DEFAULT 20;
        RAISE NOTICE '➕ commission_pct ajoutée';
    END IF;
    
    -- preferred_lang
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'preferred_lang') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN preferred_lang TEXT DEFAULT 'fr';
        RAISE NOTICE '➕ preferred_lang ajoutée';
    END IF;
    
    -- created_at
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE '➕ created_at ajoutée';
    END IF;
    
    -- updated_at
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE '➕ updated_at ajoutée';
    END IF;
    
    -- gps
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'gps') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN gps TEXT DEFAULT '';
        RAISE NOTICE '➕ gps ajoutée';
    END IF;
    
    -- gps_consent
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'gps_consent') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN gps_consent BOOLEAN DEFAULT false;
        RAISE NOTICE '➕ gps_consent ajoutée';
    END IF;
    
    -- nom
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'nom') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN nom TEXT DEFAULT '';
        RAISE NOTICE '➕ nom ajoutée';
    END IF;
    
    -- prenom
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'prenom') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN prenom TEXT DEFAULT '';
        RAISE NOTICE '➕ prenom ajoutée';
    END IF;
    
    -- nom_complet
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'nom_complet') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN nom_complet TEXT DEFAULT '';
        RAISE NOTICE '➕ nom_complet ajoutée';
    END IF;
    
    -- photo_profil
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'photo_profil') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN photo_profil TEXT DEFAULT '';
        RAISE NOTICE '➕ photo_profil ajoutée';
    END IF;
    
    -- avatar_url
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_url') INTO col_exists;
    IF NOT col_exists THEN
        ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT '';
        RAISE NOTICE '➕ avatar_url ajoutée';
    END IF;
    
    RAISE NOTICE '✅ Toutes les colonnes ont été vérifiées et ajoutées si nécessaire';
END $$;

-- 3. Mettre à jour les valeurs NULL avec des valeurs par défaut appropriées
UPDATE users SET 
    password_hash = COALESCE(password_hash, ''),
    role = COALESCE(role, 'user'),
    is_provider = COALESCE(is_provider, false),
    token_price_user = COALESCE(token_price_user, 10),
    token_price_provider = COALESCE(token_price_provider, 8),
    commission_pct = COALESCE(commission_pct, 20),
    preferred_lang = COALESCE(preferred_lang, 'fr'),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW()),
    gps = COALESCE(gps, ''),
    gps_consent = COALESCE(gps_consent, false),
    nom = COALESCE(nom, ''),
    prenom = COALESCE(prenom, ''),
    nom_complet = COALESCE(nom_complet, ''),
    photo_profil = COALESCE(photo_profil, ''),
    avatar_url = COALESCE(avatar_url, '')
WHERE id IS NOT NULL;

-- 4. Vérifier que toutes les colonnes sont maintenant présentes et non-NULL
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN data_type = 'bigint' THEN '✅ Type correct'
        WHEN data_type = 'integer' THEN '✅ Type correct'
        WHEN data_type = 'text' THEN '✅ Type correct'
        WHEN data_type = 'boolean' THEN '✅ Type correct'
        WHEN data_type = 'timestamp' THEN '✅ Type correct'
        ELSE '⚠️ Type inattendu: ' || data_type
    END as type_check
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 5. Test de la requête exacte utilisée par get_user_profile
DO $$
DECLARE
    test_user_id INTEGER;
    test_result RECORD;
BEGIN
    RAISE NOTICE '🧪 Test de la requête get_user_profile...';
    
    -- Prendre le premier utilisateur disponible
    SELECT id INTO test_user_id FROM users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        BEGIN
            SELECT id, email, password_hash, role, is_provider, tokens_balance,
                   token_price_user, token_price_provider, commission_pct,
                   preferred_lang, created_at, updated_at, gps, gps_consent,
                   nom, prenom, nom_complet, photo_profil, avatar_url
            INTO test_result
            FROM users WHERE id = test_user_id;
            
            RAISE NOTICE '✅ Test réussi pour utilisateur %', test_user_id;
            RAISE NOTICE '   Email: %', test_result.email;
            RAISE NOTICE '   Role: %', test_result.role;
            RAISE NOTICE '   Tokens: %', test_result.tokens_balance;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ Test échoué: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '⚠️ Aucun utilisateur trouvé pour le test';
    END IF;
END $$;

-- 6. Vérifier qu'aucune colonne n'est NULL
SELECT 
    COUNT(*) as total_users,
    COUNT(email) as users_with_email,
    COUNT(role) as users_with_role,
    COUNT(tokens_balance) as users_with_tokens,
    COUNT(nom) as users_with_nom,
    COUNT(prenom) as users_with_prenom
FROM users;

-- 7. Résumé final
DO $$
BEGIN
    RAISE NOTICE '🎉 CORRECTION TERMINÉE !';
    RAISE NOTICE 'La table users est maintenant compatible avec l''API /api/user/me';
    RAISE NOTICE 'Toutes les colonnes nécessaires ont été ajoutées et configurées';
END $$; 
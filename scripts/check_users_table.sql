-- Script de vérification de la table users
-- Ce script vérifie la structure de la table users pour identifier les problèmes

-- 1. Vérifier l'existence de la table
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'users';

-- 2. Vérifier la structure complète de la table users
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- 3. Vérifier les contraintes de la table
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'users';

-- 4. Vérifier les index de la table
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'users';

-- 5. Vérifier le nombre d'utilisateurs
SELECT COUNT(*) as total_users FROM users;

-- 6. Vérifier un utilisateur spécifique (remplacez 1 par l'ID de l'utilisateur test)
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
WHERE id = 1;

-- 7. Vérifier les colonnes manquantes par rapport au modèle Rust
-- Le modèle Rust attend ces colonnes :
-- id, email, password_hash, role, is_provider, tokens_balance,
-- token_price_user, token_price_provider, commission_pct,
-- preferred_lang, created_at, updated_at, gps, gps_consent,
-- nom, prenom, nom_complet, photo_profil, avatar_url

-- 8. Vérifier les types de données pour les colonnes critiques
SELECT 
    column_name,
    data_type,
    CASE 
        WHEN data_type = 'integer' AND column_name = 'id' THEN '✅ OK'
        WHEN data_type = 'character varying' AND column_name = 'email' THEN '✅ OK'
        WHEN data_type = 'character varying' AND column_name = 'password_hash' THEN '✅ OK'
        WHEN data_type = 'character varying' AND column_name = 'role' THEN '✅ OK'
        WHEN data_type = 'boolean' AND column_name = 'is_provider' THEN '✅ OK'
        WHEN data_type = 'bigint' AND column_name = 'tokens_balance' THEN '✅ OK'
        WHEN data_type = 'double precision' AND column_name = 'token_price_user' THEN '✅ OK'
        WHEN data_type = 'double precision' AND column_name = 'token_price_provider' THEN '✅ OK'
        WHEN data_type = 'real' AND column_name = 'commission_pct' THEN '✅ OK'
        WHEN data_type = 'character varying' AND column_name = 'preferred_lang' THEN '✅ OK'
        WHEN data_type = 'timestamp without time zone' AND column_name = 'created_at' THEN '✅ OK'
        WHEN data_type = 'timestamp without time zone' AND column_name = 'updated_at' THEN '✅ OK'
        WHEN data_type = 'character varying' AND column_name = 'gps' THEN '✅ OK'
        WHEN data_type = 'boolean' AND column_name = 'gps_consent' THEN '✅ OK'
        WHEN data_type = 'character varying' AND column_name = 'nom' THEN '✅ OK'
        WHEN data_type = 'character varying' AND column_name = 'prenom' THEN '✅ OK'
        WHEN data_type = 'character varying' AND column_name = 'nom_complet' THEN '✅ OK'
        WHEN data_type = 'character varying' AND column_name = 'photo_profil' THEN '✅ OK'
        WHEN data_type = 'character varying' AND column_name = 'avatar_url' THEN '✅ OK'
        ELSE '❌ TYPE INCOMPATIBLE'
    END as compatibility_check
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- 9. Vérifier les valeurs NULL dans les colonnes critiques
SELECT 
    'id' as column_name,
    COUNT(*) as total_rows,
    COUNT(id) as non_null_values,
    COUNT(*) - COUNT(id) as null_values
FROM users
UNION ALL
SELECT 
    'email' as column_name,
    COUNT(*) as total_rows,
    COUNT(email) as non_null_values,
    COUNT(*) - COUNT(email) as null_values
FROM users
UNION ALL
SELECT 
    'role' as column_name,
    COUNT(*) as total_rows,
    COUNT(role) as non_null_values,
    COUNT(*) - COUNT(role) as null_values
FROM users
UNION ALL
SELECT 
    'tokens_balance' as column_name,
    COUNT(*) as total_rows,
    COUNT(tokens_balance) as non_null_values,
    COUNT(*) - COUNT(tokens_balance) as null_values
FROM users;

-- 10. Vérifier les contraintes de clé primaire
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'users' 
    AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY kcu.ordinal_position; 
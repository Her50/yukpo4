-- Script de correction de la colonne tokens_balance
-- Ce script vérifie et corrige spécifiquement la colonne tokens_balance

-- 1. Vérifier l'existence de la colonne tokens_balance
DO $$
DECLARE
    col_exists BOOLEAN;
BEGIN
    RAISE NOTICE '🔍 Vérification de la colonne tokens_balance...';
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'tokens_balance'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE '➕ Ajout de la colonne tokens_balance...';
        ALTER TABLE users ADD COLUMN tokens_balance BIGINT NOT NULL DEFAULT 2000;
        RAISE NOTICE '✅ Colonne tokens_balance ajoutée avec succès';
    ELSE
        RAISE NOTICE '✅ Colonne tokens_balance existe déjà';
    END IF;
END $$;

-- 2. Vérifier le type de données de la colonne
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN data_type = 'bigint' THEN '✅ Type correct'
        WHEN data_type = 'integer' THEN '⚠️ Type integer (peut causer des problèmes)'
        ELSE '❌ Type incorrect: ' || data_type
    END as type_check
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'tokens_balance';

-- 3. Vérifier les valeurs actuelles
SELECT 
    COUNT(*) as total_users,
    COUNT(tokens_balance) as users_with_balance,
    COUNT(*) - COUNT(tokens_balance) as users_without_balance,
    MIN(tokens_balance) as min_balance,
    MAX(tokens_balance) as max_balance,
    AVG(tokens_balance) as avg_balance
FROM users;

-- 4. Corriger le type si nécessaire
DO $$
DECLARE
    current_type TEXT;
BEGIN
    SELECT data_type INTO current_type
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'tokens_balance';
    
    IF current_type = 'integer' THEN
        RAISE NOTICE '🔄 Conversion de integer vers bigint...';
        ALTER TABLE users ALTER COLUMN tokens_balance TYPE BIGINT;
        RAISE NOTICE '✅ Conversion terminée';
    ELSIF current_type = 'bigint' THEN
        RAISE NOTICE '✅ Type déjà correct (bigint)';
    ELSE
        RAISE NOTICE '⚠️ Type inattendu: %', current_type;
    END IF;
END $$;

-- 5. Mettre à jour les valeurs NULL ou manquantes
UPDATE users 
SET tokens_balance = 2000
WHERE tokens_balance IS NULL;

-- 6. Vérifier qu'un utilisateur peut être récupéré avec tokens_balance
SELECT 
    id,
    email,
    tokens_balance,
    CASE 
        WHEN tokens_balance IS NOT NULL THEN '✅ OK'
        ELSE '❌ NULL'
    END as balance_status
FROM users 
LIMIT 5;

-- 7. Test de la requête utilisée par get_user_balance
-- Simuler la requête exacte du backend
SELECT 
    tokens_balance,
    CASE 
        WHEN tokens_balance IS NOT NULL THEN '✅ Requête réussie'
        ELSE '❌ Requête échouée'
    END as query_status
FROM users 
WHERE id = 1; -- Remplacer 1 par un ID d'utilisateur existant

-- 8. Vérifier les contraintes et index
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'users' AND constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK');

-- 9. Vérifier que la colonne est accessible via SQLx
-- Cette requête simule exactement ce que fait le backend
DO $$
DECLARE
    test_result BIGINT;
BEGIN
    BEGIN
        SELECT tokens_balance INTO test_result
        FROM users 
        WHERE id = 1; -- Remplacer 1 par un ID d'utilisateur existant
        
        IF test_result IS NOT NULL THEN
            RAISE NOTICE '✅ Test SQLx réussi: tokens_balance = %', test_result;
        ELSE
            RAISE NOTICE '⚠️ Test SQLx: tokens_balance est NULL';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Test SQLx échoué: %', SQLERRM;
    END;
END $$; 
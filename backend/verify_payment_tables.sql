-- Script de vérification des tables de paiement
-- À exécuter pour vérifier que les tables existent et sont correctement configurées

-- Vérifier l'existence des tables
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('payment_transactions', 'token_transactions') THEN '✓ Table existe'
        ELSE '✗ Table manquante'
    END as status
FROM information_schema.tables 
WHERE table_name IN ('payment_transactions', 'token_transactions')
ORDER BY table_name;

-- Vérifier la structure de payment_transactions
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'payment_transactions'
ORDER BY ordinal_position;

-- Vérifier la structure de token_transactions
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'token_transactions'
ORDER BY ordinal_position;

-- Vérifier les index
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('payment_transactions', 'token_transactions')
ORDER BY tablename, indexname;

-- Vérifier les contraintes de clé étrangère
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name IN ('payment_transactions', 'token_transactions')
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name;

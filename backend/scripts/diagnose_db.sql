-- Script de diagnostic de la base de données
-- Vérifier la structure des tables principales

-- 1. Vérifier la table users
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 2. Vérifier la table services
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'services' 
ORDER BY ordinal_position;

-- 3. Vérifier la table echanges
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'echanges' 
ORDER BY ordinal_position;

-- 4. Vérifier la table payment_attempts
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'payment_attempts' 
ORDER BY ordinal_position;

-- 5. Vérifier la table alerts
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'alerts' 
ORDER BY ordinal_position;

-- 6. Vérifier la table service_logs
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'service_logs' 
ORDER BY ordinal_position;

-- 7. Vérifier la table programmes_scolaires
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'programmes_scolaires' 
ORDER BY ordinal_position; 
-- ============================================
-- VÉRIFICATION : État de la migration
-- ============================================
-- Date: 2026-01-03
-- Objectif: Vérifier si la migration service_products a été appliquée
-- ============================================

\echo '🔍 Vérification de l''état de la migration...'

-- ============================================
-- 1. Vérifier si la table products (UUID) existe
-- ============================================
SELECT 
    'products (UUID)' as table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'products'
        ) THEN '✅ EXISTE'
        ELSE '❌ N''EXISTE PAS'
    END as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'id' AND data_type = 'uuid'
        ) THEN '✅ Structure UUID (tickets de bus)'
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'id' AND data_type = 'integer'
        ) THEN '⚠️ Structure SERIAL (ancienne structure)'
        ELSE '❓ Structure inconnue'
    END as structure_type;

-- ============================================
-- 2. Vérifier si la table service_products (SERIAL) existe
-- ============================================
SELECT 
    'service_products (SERIAL)' as table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'service_products'
        ) THEN '✅ EXISTE'
        ELSE '❌ N''EXISTE PAS'
    END as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'service_products' AND column_name = 'id' AND data_type = 'integer'
        ) THEN '✅ Structure SERIAL (produits de services)'
        ELSE '❓ Structure inconnue'
    END as structure_type;

-- ============================================
-- 3. Détails de la structure service_products (si existe)
-- ============================================
SELECT 
    'service_products' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'service_products'
ORDER BY ordinal_position;

-- ============================================
-- 4. Vérifier les index de service_products
-- ============================================
SELECT 
    'service_products' as table_name,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'service_products'
ORDER BY indexname;

-- ============================================
-- 5. Vérifier les triggers de service_products
-- ============================================
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'service_products';

-- ============================================
-- 6. Statistiques rapides
-- ============================================
SELECT 
    'Nombre de produits dans service_products' as metric,
    COUNT(*)::BIGINT as count
FROM service_products
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_products');

\echo '✅ Vérification terminée !'


-- Script SQL pour vérifier les tables, index et fonctions dans Cloud SQL PostgreSQL
-- Date: 2026-02-15

-- ============================================================================
-- 1. VÉRIFICATION DES TABLES
-- ============================================================================

\echo '========================================'
\echo '1. TABLES PRINCIPALES'
\echo '========================================'

-- Compter le nombre total de tables
SELECT 
    COUNT(*) as total_tables,
    COUNT(*) FILTER (WHERE table_name IN ('users', 'services', 'deliveries', 'orders', 'products', 'couriers', 'ratings', 'notifications', 'video_jobs', 'audio_jobs', 'story_templates', 'commerce_connectors', 'feature_flags')) as tables_critiques
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- Lister toutes les tables
\echo ''
\echo 'Liste de toutes les tables:'
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Vérifier les tables critiques
\echo ''
\echo 'Vérification des tables critiques:'
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t.table_name
        ) THEN '✅ EXISTE'
        ELSE '❌ MANQUANTE'
    END as statut
FROM (VALUES 
    ('users'),
    ('services'),
    ('deliveries'),
    ('orders'),
    ('products'),
    ('couriers'),
    ('ratings'),
    ('notifications'),
    ('video_jobs'),
    ('audio_jobs'),
    ('story_templates'),
    ('commerce_connectors'),
    ('feature_flags')
) AS t(table_name);

-- ============================================================================
-- 2. VÉRIFICATION DES INDEX
-- ============================================================================

\echo ''
\echo '========================================'
\echo '2. INDEX'
\echo '========================================'

-- Compter le nombre total d'index
SELECT COUNT(*) as total_indexes
FROM pg_indexes 
WHERE schemaname = 'public';

-- Lister tous les index par table
\echo ''
\echo 'Index par table (premiers 50):'
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname
LIMIT 50;

-- Vérifier les index critiques (exemples)
\echo ''
\echo 'Vérification des index critiques:'
SELECT 
    tablename,
    indexname,
    CASE 
        WHEN indexname IS NOT NULL THEN '✅ EXISTE'
        ELSE '❌ MANQUANT'
    END as statut
FROM (
    SELECT DISTINCT tablename 
    FROM pg_indexes 
    WHERE schemaname = 'public'
    AND tablename IN ('users', 'services', 'deliveries', 'orders', 'products')
) t
LEFT JOIN pg_indexes i ON i.tablename = t.tablename AND i.schemaname = 'public'
WHERE i.indexname IS NOT NULL
GROUP BY t.tablename, i.indexname
ORDER BY t.tablename, i.indexname
LIMIT 20;

-- ============================================================================
-- 3. VÉRIFICATION DES FONCTIONS
-- ============================================================================

\echo ''
\echo '========================================'
\echo '3. FONCTIONS'
\echo '========================================'

-- Compter le nombre total de fonctions
SELECT COUNT(*) as total_functions
FROM information_schema.routines 
WHERE routine_schema = 'public';

-- Lister toutes les fonctions
\echo ''
\echo 'Liste de toutes les fonctions (premiers 50):'
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name
LIMIT 50;

-- Vérifier les fonctions critiques (exemples)
\echo ''
\echo 'Vérification des fonctions critiques:'
SELECT 
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name IS NOT NULL THEN '✅ EXISTE'
        ELSE '❌ MANQUANTE'
    END as statut
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name IN (
    'hybrid_image_search',
    'refresh_services_search_optimized',
    'search_services_gps',
    'search_products_gps',
    'calculate_distance'
)
ORDER BY routine_name;

-- ============================================================================
-- 4. VÉRIFICATION DES MIGRATIONS SQLX
-- ============================================================================

\echo ''
\echo '========================================'
\echo '4. MIGRATIONS SQLX'
\echo '========================================'

-- Vérifier si la table _sqlx_migrations existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '_sqlx_migrations'
        ) THEN '✅ TABLE _sqlx_migrations EXISTE'
        ELSE '❌ TABLE _sqlx_migrations MANQUANTE'
    END as statut_migrations_table;

-- Compter les migrations appliquées
SELECT 
    COUNT(*) as migrations_appliquees,
    MAX(installed_on) as derniere_migration
FROM _sqlx_migrations;

-- Lister les dernières migrations appliquées
\echo ''
\echo 'Dernières migrations appliquées (10 dernières):'
SELECT 
    version,
    description,
    installed_on,
    success
FROM _sqlx_migrations
ORDER BY installed_on DESC
LIMIT 10;

-- ============================================================================
-- 5. VÉRIFICATION DES EXTENSIONS
-- ============================================================================

\echo ''
\echo '========================================'
\echo '5. EXTENSIONS POSTGRESQL'
\echo '========================================'

-- Lister les extensions installées
SELECT 
    extname as extension_name,
    extversion as version
FROM pg_extension
ORDER BY extname;

-- Vérifier les extensions critiques
\echo ''
\echo 'Vérification des extensions critiques:'
SELECT 
    extname,
    CASE 
        WHEN extname IS NOT NULL THEN '✅ INSTALLÉE'
        ELSE '❌ NON INSTALLÉE'
    END as statut
FROM pg_extension
WHERE extname IN ('pgvector', 'postgis', 'unaccent', 'imgsmlr', 'uuid-ossp')
ORDER BY extname;

-- ============================================================================
-- 6. RÉSUMÉ
-- ============================================================================

\echo ''
\echo '========================================'
\echo '6. RÉSUMÉ'
\echo '========================================'

SELECT 
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as total_tables,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as total_indexes,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public') as total_functions,
    (SELECT COUNT(*) FROM pg_extension) as total_extensions,
    (SELECT COUNT(*) FROM _sqlx_migrations) as migrations_appliquees;


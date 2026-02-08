-- Script de vérification de toutes les tables dans la base de données
-- Exécuter avec: psql $DATABASE_URL -f backend/scripts/check_all_tables.sql

\echo '🔍 ========== VÉRIFICATION DES TABLES =========='
\echo ''

-- 1. Liste de toutes les tables dans le schéma public
\echo '1️⃣ Liste de toutes les tables dans le schéma public:'
SELECT 
    table_name,
    CASE 
        WHEN table_type = 'BASE TABLE' THEN 'Table'
        WHEN table_type = 'VIEW' THEN 'Vue'
        ELSE table_type
    END as type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

\echo ''
\echo '2️⃣ Nombre total de tables:'
SELECT COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

\echo ''
\echo '3️⃣ Vérification des tables critiques:'
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t.table_name
        ) 
        THEN '✅ EXISTE' 
        ELSE '❌ MANQUANTE' 
    END as status
FROM (VALUES 
    ('users'),
    ('services'),
    ('deliveries'),
    ('product_creation_queue'),
    ('delivery_matching_queue'),
    ('global_promo_events'),
    ('live_flash_sales'),
    ('product_orders'),
    ('social_publication_jobs'),
    ('video_generation_jobs'),
    ('delivery_proximity_suggestions'),
    ('publicites'),
    ('taxis_ville'),
    ('pharmacies'),
    ('hopitaux_cliniques'),
    ('laboratoires_imagerie'),
    ('agences_voyage'),
    ('covoiturages'),
    ('_sqlx_migrations')
) AS t(table_name)
ORDER BY table_name;

\echo ''
\echo '4️⃣ Vérification des migrations appliquées:'
SELECT 
    version,
    description,
    installed_on,
    success
FROM _sqlx_migrations 
ORDER BY installed_on DESC 
LIMIT 10;

\echo ''
\echo '5️⃣ Statistiques des tables principales:'
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

\echo ''
\echo '✅ Vérification terminée'







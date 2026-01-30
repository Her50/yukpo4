-- Script SQL pour vérifier l'état des migrations dans la base de données
-- Exécuter avec: psql $DATABASE_URL -f backend/scripts/check_migration_status.sql

\echo '🔍 ========== VÉRIFICATION DE L''ÉTAT DES MIGRATIONS =========='
\echo ''

-- 1. Vérifier si la table _sqlx_migrations existe
\echo '1️⃣ Vérification de la table _sqlx_migrations:'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '_sqlx_migrations'
        ) 
        THEN '✅ Table _sqlx_migrations EXISTE' 
        ELSE '❌ Table _sqlx_migrations MANQUANTE' 
    END as status;

\echo ''
\echo '2️⃣ Migrations appliquées (10 dernières):'
SELECT 
    version,
    description,
    installed_on,
    success,
    CASE 
        WHEN success THEN '✅' 
        ELSE '❌' 
    END as status_icon
FROM _sqlx_migrations 
ORDER BY installed_on DESC 
LIMIT 10;

\echo ''
\echo '3️⃣ Statistiques des migrations:'
SELECT 
    COUNT(*) as total_migrations,
    COUNT(CASE WHEN success = true THEN 1 END) as successful,
    COUNT(CASE WHEN success = false THEN 1 END) as failed,
    MIN(installed_on) as first_migration,
    MAX(installed_on) as last_migration
FROM _sqlx_migrations;

\echo ''
\echo '4️⃣ Vérification de la migration 0 (create all tables):'
SELECT 
    version,
    description,
    installed_on,
    success,
    CASE 
        WHEN description = 'create all tables' THEN '✅ Description correcte'
        ELSE '⚠️ Description inattendue: ' || description
    END as description_check
FROM _sqlx_migrations 
WHERE version = 0;

\echo ''
\echo '5️⃣ Vérification des tables critiques créées par les migrations:'
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
    ('covoiturages')
) AS t(table_name)
ORDER BY table_name;

\echo ''
\echo '6️⃣ Vérification des migrations récentes (dernières 24h):'
SELECT 
    version,
    description,
    installed_on,
    success
FROM _sqlx_migrations 
WHERE installed_on > NOW() - INTERVAL '24 hours'
ORDER BY installed_on DESC;

\echo ''
\echo '✅ Vérification terminée'



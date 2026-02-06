-- Script SQL pour vérifier l'état des migrations dans la base PostgreSQL AWS
-- Exécuter avec: psql $DATABASE_URL -f backend/scripts/check_aws_migrations.sql
-- OU via ECS task (voir instructions ci-dessous)

\echo '🔍 ========== ÉTAT DES MIGRATIONS DANS AWS =========='
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
        ELSE '❌ Table _sqlx_migrations MANQUANTE - Aucune migration n''a été appliquée' 
    END as status;

\echo ''
\echo '2️⃣ Nombre total de migrations appliquées:'
SELECT 
    COUNT(*) as total_migrations,
    COUNT(CASE WHEN success = true THEN 1 END) as successful,
    COUNT(CASE WHEN success = false THEN 1 END) as failed
FROM _sqlx_migrations;

\echo ''
\echo '3️⃣ Dernières 20 migrations appliquées (ordre chronologique):'
SELECT 
    version,
    description,
    installed_on,
    CASE 
        WHEN success THEN '✅' 
        ELSE '❌' 
    END as status,
    execution_time as exec_time_ms
FROM _sqlx_migrations 
ORDER BY installed_on DESC 
LIMIT 20;

\echo ''
\echo '4️⃣ Première migration (0000_create_all_tables):'
SELECT 
    version,
    description,
    installed_on,
    success,
    CASE 
        WHEN success THEN '✅ Migration 0 appliquée avec succès' 
        ELSE '❌ Migration 0 a échoué' 
    END as status
FROM _sqlx_migrations 
WHERE version = 0;

\echo ''
\echo '5️⃣ Migrations échouées (si présentes):'
SELECT 
    version,
    description,
    installed_on,
    execution_time as exec_time_ms
FROM _sqlx_migrations 
WHERE success = false 
ORDER BY installed_on DESC;

\echo ''
\echo '6️⃣ Statistiques par date (dernières 7 migrations):'
SELECT 
    DATE(installed_on) as date,
    COUNT(*) as migrations_count,
    COUNT(CASE WHEN success = true THEN 1 END) as successful,
    COUNT(CASE WHEN success = false THEN 1 END) as failed
FROM _sqlx_migrations 
GROUP BY DATE(installed_on)
ORDER BY date DESC
LIMIT 7;

\echo ''
\echo '7️⃣ Vérification des tables critiques créées par les migrations:'
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('users', 'services', 'deliveries', 'products', 'media') 
        THEN '✅ Table critique'
        ELSE '📋 Table standard'
    END as importance
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'users', 'services', 'deliveries', 'products', 'media', 
    'specialized_reservations', 'pharmacy_products', 'video_generation_jobs'
)
ORDER BY table_name;

\echo ''
\echo '✅ Diagnostic terminé'
\echo ''





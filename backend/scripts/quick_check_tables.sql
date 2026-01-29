-- Vérification rapide des tables critiques
-- Exécuter avec: psql $DATABASE_URL -f backend/scripts/quick_check_tables.sql

-- Tables critiques
SELECT 
    'users' as table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') 
         THEN '✅ EXISTE' ELSE '❌ MANQUANTE' END as status
UNION ALL
SELECT 'services', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') 
         THEN '✅ EXISTE' ELSE '❌ MANQUANTE' END
UNION ALL
SELECT 'deliveries', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deliveries') 
         THEN '✅ EXISTE' ELSE '❌ MANQUANTE' END
UNION ALL
SELECT 'product_creation_queue', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_creation_queue') 
         THEN '✅ EXISTE' ELSE '❌ MANQUANTE' END
UNION ALL
SELECT '_sqlx_migrations', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_sqlx_migrations') 
         THEN '✅ EXISTE' ELSE '❌ MANQUANTE' END;

-- Nombre de migrations appliquées
SELECT 
    COUNT(*) as total_migrations,
    COUNT(CASE WHEN success = true THEN 1 END) as successful
FROM _sqlx_migrations;


-- Script de diagnostic pour comprendre pourquoi les migrations ne passent pas
-- À exécuter directement sur AWS RDS

-- 1. Vérifier l'état de la table _sqlx_migrations
SELECT 
    version,
    description,
    installed_on,
    success,
    execution_time,
    encode(checksum, 'hex') as checksum_hex
FROM _sqlx_migrations
ORDER BY version
LIMIT 20;

-- 2. Vérifier quelles tables existent
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN (
        'users', 'services', 'media',
        'live_sessions', 'live_flash_sales',
        'parcel_types', 'couriers', 'delivery_parcels', 'deliveries',
        'delivery_zones', 'delivery_matching_queue',
        'product_creation_queue', 'product_orders',
        'global_promo_events', 'social_publication_jobs',
        'video_generation_jobs', 'delivery_proximity_suggestions'
    )
ORDER BY table_name;

-- 3. Vérifier les types ENUM nécessaires
SELECT 
    typname as enum_name,
    array_agg(enumlabel ORDER BY enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN (
    'delivery_status',
    'delivery_cancel_reason',
    'delivery_courier_status',
    'delivery_matching_status'
)
GROUP BY typname;

-- 4. Vérifier les tables de dépendance intermédiaires
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'users'
        ) THEN '✅'
        ELSE '❌'
    END as users_exists,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'services'
        ) THEN '✅'
        ELSE '❌'
    END as services_exists,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'live_sessions'
        ) THEN '✅'
        ELSE '❌'
    END as live_sessions_exists,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'parcel_types'
        ) THEN '✅'
        ELSE '❌'
    END as parcel_types_exists,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'couriers'
        ) THEN '✅'
        ELSE '❌'
    END as couriers_exists,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'delivery_parcels'
        ) THEN '✅'
        ELSE '❌'
    END as delivery_parcels_exists,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'delivery_zones'
        ) THEN '✅'
        ELSE '❌'
    END as delivery_zones_exists
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name = 'users'  -- Juste pour avoir une ligne de résultat
LIMIT 1;

-- 5. Vérifier les erreurs récentes dans les logs PostgreSQL (si accessible)
-- Note: Cette requête nécessite l'accès aux logs, ce qui peut ne pas être disponible
SELECT 
    'Vérifiez les logs CloudWatch pour les erreurs de migration' as note;


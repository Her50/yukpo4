-- Rapport de verification complete de la base de donnees AWS
-- Execute toutes les verifications et genere un rapport JSON

-- 1. Migrations
SELECT json_build_object(
    'section', 'migrations',
    'total', (SELECT COUNT(*) FROM _sqlx_migrations),
    'successful', (SELECT COUNT(*) FROM _sqlx_migrations WHERE success = true),
    'failed', (SELECT COUNT(*) FROM _sqlx_migrations WHERE success = false),
    'last_20', (
        SELECT json_agg(json_build_object(
            'version', version,
            'description', description,
            'installed_on', installed_on,
            'success', success
        ))
        FROM (
            SELECT version, description, installed_on, success 
            FROM _sqlx_migrations 
            ORDER BY version DESC 
            LIMIT 20
        ) sub
    )
);

-- 2. Tables critiques
SELECT json_build_object(
    'section', 'tables',
    'critical_tables', (
        SELECT json_agg(json_build_object(
            'name', table_name,
            'exists', true
        ))
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name IN (
            'users', 'services', 'media', 'user_saved_addresses',
            'autocomplete_characteristics', 'autocomplete_combinations',
            'service_products', 'products_lifecycle', 'service_reviews',
            'deliveries', 'delivery_requests', 'courier_profiles'
        )
    ),
    'missing_tables', (
        SELECT json_agg(table_name)
        FROM (
            SELECT unnest(ARRAY[
                'users', 'services', 'media', 'user_saved_addresses',
                'autocomplete_characteristics', 'autocomplete_combinations',
                'service_products', 'products_lifecycle', 'service_reviews',
                'deliveries', 'delivery_requests', 'courier_profiles'
            ]) as table_name
        ) expected
        WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.tables t
            WHERE t.table_schema = 'public' 
            AND t.table_name = expected.table_name
        )
    )
);

-- 3. Fonctions critiques
SELECT json_build_object(
    'section', 'functions',
    'critical_functions', (
        SELECT json_agg(json_build_object(
            'name', proname,
            'exists', true
        ))
        FROM pg_proc 
        WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND proname IN (
            'calculate_best_vector_match_score', 
            'product_combination_exists', 
            'calculate_vector_match_score_optimized',
            'refresh_services_search_optimized'
        )
    ),
    'missing_functions', (
        SELECT json_agg(func_name)
        FROM (
            SELECT unnest(ARRAY[
                'calculate_best_vector_match_score',
                'product_combination_exists',
                'calculate_vector_match_score_optimized',
                'refresh_services_search_optimized'
            ]) as func_name
        ) expected
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_proc p
            WHERE p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            AND p.proname = expected.func_name
        )
    )
);

-- 4. Index critiques
SELECT json_build_object(
    'section', 'indexes',
    'critical_indexes', (
        SELECT json_agg(json_build_object(
            'name', indexname,
            'table', tablename,
            'exists', true
        ))
        FROM pg_indexes 
        WHERE schemaname = 'public'
        AND (
            indexname LIKE 'idx_user_saved_addresses%' 
            OR indexname = 'idx_services_search_optimized_v2_unique'
        )
    ),
    'missing_indexes', (
        SELECT json_agg(json_build_object('name', idx_name, 'table', tbl_name))
        FROM (
            SELECT 'idx_user_saved_addresses_user_id' as idx_name, 'user_saved_addresses' as tbl_name
            UNION ALL
            SELECT 'idx_services_search_optimized_v2_unique', 'services_search_optimized_v2'
        ) expected
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_indexes i
            WHERE i.schemaname = 'public'
            AND i.indexname = expected.idx_name
            AND i.tablename = expected.tbl_name
        )
    )
);

-- 5. Vue materialisee
SELECT json_build_object(
    'section', 'materialized_views',
    'services_search_optimized_v2', (
        SELECT json_build_object(
            'exists', EXISTS (
                SELECT 1 FROM pg_matviews 
                WHERE schemaname = 'public' 
                AND matviewname = 'services_search_optimized_v2'
            ),
            'has_unique_index', EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public'
                AND tablename = 'services_search_optimized_v2'
                AND indexname = 'idx_services_search_optimized_v2_unique'
            )
        )
    )
);

-- 6. Statistiques generales
SELECT json_build_object(
    'section', 'statistics',
    'total_tables', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
    'total_functions', (SELECT COUNT(*) FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')),
    'total_indexes', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public'),
    'total_views', (SELECT COUNT(*) FROM pg_views WHERE schemaname = 'public'),
    'total_materialized_views', (SELECT COUNT(*) FROM pg_matviews WHERE schemaname = 'public')
);




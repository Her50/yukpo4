-- Test rapide et simple
SELECT pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'search_services_gps_final' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') ORDER BY oid DESC LIMIT 1;
SELECT COUNT(*) FROM search_services_gps_final('test', NULL, 50, 1);


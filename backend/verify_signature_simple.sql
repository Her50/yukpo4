-- Vérification simple de la signature
SELECT 
    pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'search_services_gps_final'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY oid DESC
LIMIT 1;


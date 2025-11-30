-- Script de vérification de la fonction GPS après migration
-- =========================================================

-- 1. Vérifier la signature de la fonction
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'search_services_gps_final'
AND n.nspname = 'public';

-- 2. Vérifier que DEFAULT NULL est présent dans la définition
SELECT 
    CASE 
        WHEN pg_get_functiondef(oid) LIKE '%user_gps_zone text DEFAULT NULL%' 
        THEN '✅ Signature correcte avec DEFAULT NULL'
        ELSE '❌ Signature INCORRECTE - DEFAULT NULL manquant'
    END as signature_status,
    pg_get_functiondef(oid) as full_definition
FROM pg_proc
WHERE proname = 'search_services_gps_final'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY oid DESC
LIMIT 1;

-- 3. Tester la fonction avec NULL (doit fonctionner maintenant)
SELECT 
    'Test avec NULL' as test_type,
    COUNT(*) as resultats
FROM search_services_gps_final('test', NULL, 50, 10);


-- Nettoyage des fonctions GPS dupliquées
-- =====================================

-- 1. Lister toutes les fonctions GPS existantes
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    p.oid as function_oid
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN (
    'search_services_gps_final',
    'extract_gps_coordinates', 
    'extract_gps_from_json',
    'fast_gps_search_with_user_fallback',
    'fast_text_gps_search_with_user_fallback',
    'get_user_gps',
    'calculate_gps_distance_km',
    'calculate_intelligent_radius'
)
ORDER BY p.proname, p.oid;

-- 2. Supprimer toutes les fonctions GPS existantes
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, bigint) CASCADE;
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, double precision) CASCADE;
DROP FUNCTION IF EXISTS search_services_gps_final(text, text) CASCADE;
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer) CASCADE;

DROP FUNCTION IF EXISTS extract_gps_coordinates(jsonb) CASCADE;
DROP FUNCTION IF EXISTS extract_gps_coordinates(text) CASCADE;

DROP FUNCTION IF EXISTS extract_gps_from_json(jsonb) CASCADE;
DROP FUNCTION IF EXISTS extract_gps_from_json(text) CASCADE;

DROP FUNCTION IF EXISTS fast_gps_search_with_user_fallback(text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS fast_gps_search_with_user_fallback(text, text, bigint) CASCADE;

DROP FUNCTION IF EXISTS fast_text_gps_search_with_user_fallback(text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS fast_text_gps_search_with_user_fallback(text, text, bigint) CASCADE;

DROP FUNCTION IF EXISTS get_user_gps(integer) CASCADE;
DROP FUNCTION IF EXISTS get_user_gps(bigint) CASCADE;

DROP FUNCTION IF EXISTS calculate_gps_distance_km(double precision, double precision, double precision, double precision) CASCADE;
DROP FUNCTION IF EXISTS calculate_gps_distance_km(real, real, real, real) CASCADE;

DROP FUNCTION IF EXISTS calculate_intelligent_radius(double precision) CASCADE;
DROP FUNCTION IF EXISTS calculate_intelligent_radius(real) CASCADE;

-- 3. Vérifier que toutes les fonctions ont été supprimées
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN (
    'search_services_gps_final',
    'extract_gps_coordinates', 
    'extract_gps_from_json',
    'fast_gps_search_with_user_fallback',
    'fast_text_gps_search_with_user_fallback',
    'get_user_gps',
    'calculate_gps_distance_km',
    'calculate_intelligent_radius'
)
ORDER BY p.proname; 
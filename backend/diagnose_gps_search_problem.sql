-- DIAGNOSTIC COMPLET DU PROBLÈME DE RECHERCHE GPS
-- Base de données: yukpo_db
-- Problème: 0 résultats malgré le filtrage GPS

-- 1. VÉRIFIER QUE LA FONCTION EXISTE
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'search_services_gps_final'
    ) THEN '✅ FONCTION EXISTE' ELSE '❌ FONCTION MANQUANTE' END as status_function;

-- 2. VÉRIFIER LES DONNÉES GPS DANS SERVICES
SELECT 
    'DONNÉES GPS DANS SERVICES' as section,
    COUNT(*) as total_services,
    COUNT(CASE WHEN data->>'gps_fixe' IS NOT NULL AND data->>'gps_fixe' != '' THEN 1 END) as services_with_gps_fixe,
    COUNT(CASE WHEN gps IS NOT NULL AND gps != '' AND gps != 'false' THEN 1 END) as services_with_gps,
    COUNT(CASE WHEN data->>'gps_fixe' IS NULL OR data->>'gps_fixe' = '' THEN 1 END) as services_without_gps_fixe
FROM services;

-- 3. VÉRIFIER LES DONNÉES GPS DANS USERS
SELECT 
    'DONNÉES GPS DANS USERS' as section,
    COUNT(*) as total_users,
    COUNT(CASE WHEN gps IS NOT NULL AND gps != '' THEN 1 END) as users_with_gps,
    COUNT(CASE WHEN gps IS NULL OR gps = '' THEN 1 END) as users_without_gps
FROM users;

-- 4. TESTER LA FONCTION EXTRACT_GPS_FROM_JSON
SELECT 
    'TEST EXTRACT_GPS_FROM_JSON' as section,
    'gps_fixe example' as test_case,
    g.lat, g.lng
FROM services s
CROSS JOIN LATERAL extract_gps_from_json(s.data->>'gps_fixe') g
WHERE s.data->>'gps_fixe' IS NOT NULL 
AND s.data->>'gps_fixe' != ''
LIMIT 3;

-- 5. TESTER LA FONCTION GET_USER_GPS
SELECT 
    'TEST GET_USER_GPS' as section,
    s.user_id,
    u.gps as user_gps,
    g.lat, g.lng
FROM services s
JOIN users u ON s.user_id = u.id
CROSS JOIN LATERAL get_user_gps(s.user_id) g
WHERE u.gps IS NOT NULL AND u.gps != ''
LIMIT 3;

-- 6. TESTER LA FONCTION COMPLÈTE AVEC UNE ZONE GPS RÉELLE
-- Utiliser la zone GPS des logs: "4.325294310662794,9.387347384169695|3.781463577904371,9.77873532362282|4.0842458349170965,10.134417696669695|4.308861575126459,9.84190671034157"
SELECT 
    'TEST SEARCH_SERVICES_GPS_FINAL' as section,
    'Zone GPS des logs' as test_case,
    COUNT(*) as total_results
FROM search_services_gps_final(
    'restaurant',  -- recherche textuelle
    '4.325294310662794,9.387347384169695|3.781463577904371,9.77873532362282|4.0842458349170965,10.134417696669695|4.308861575126459,9.84190671034157',  -- zone GPS
    50,  -- rayon 50km
    20   -- max 20 résultats
);

-- 7. TESTER SANS FILTRAGE GPS (pour comparer)
SELECT 
    'TEST SANS FILTRAGE GPS' as section,
    COUNT(*) as total_results
FROM search_services_gps_final(
    'restaurant',  -- recherche textuelle
    NULL,  -- pas de zone GPS
    50,    -- rayon 50km
    20     -- max 20 résultats
);

-- 8. VÉRIFIER LES SERVICES AVEC LE MOT "restaurant"
SELECT 
    'SERVICES AVEC MOT "restaurant"' as section,
    COUNT(*) as total_services,
    COUNT(CASE WHEN data->>'titre_service' ILIKE '%restaurant%' THEN 1 END) as titre_contains_restaurant,
    COUNT(CASE WHEN data->>'description' ILIKE '%restaurant%' THEN 1 END) as description_contains_restaurant
FROM services
WHERE data->>'titre_service' ILIKE '%restaurant%' 
   OR data->>'description' ILIKE '%restaurant%';

-- 9. TESTER LA FONCTION FAST_TEXT_GPS_SEARCH_WITH_USER_FALLBACK DIRECTEMENT
SELECT 
    'TEST FAST_TEXT_GPS_SEARCH_WITH_USER_FALLBACK' as section,
    COUNT(*) as total_results
FROM fast_text_gps_search_with_user_fallback(
    'restaurant',
    '4.325294310662794,9.387347384169695|3.781463577904371,9.77873532362282|4.0842458349170965,10.134417696669695|4.308861575126459,9.84190671034157',
    50,
    20
);

-- 10. VÉRIFIER LES ERREURS DANS LES LOGS POSTGRESQL
-- (Cette requête peut ne pas fonctionner selon la configuration)
SELECT 
    'VÉRIFICATION LOGS POSTGRESQL' as section,
    'Vérifiez manuellement les logs PostgreSQL pour des erreurs' as instruction; 
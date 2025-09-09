-- Diagnostic de l'appel de la fonction GPS
-- ========================================

-- 1. Vérifier la signature exacte de notre fonction
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    p.oid as function_oid
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'search_services_gps_final'
ORDER BY p.oid;

-- 2. Tester l'appel avec 3 paramètres (notre signature)
SELECT 
    'Test 3 parametres' as test_type,
    COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant',
    '4.332778557312556,9.169371770309054|3.5546023108516125,9.869750188277804|4.253351169137149,10.377867864059054|4.395766768897358,9.891722844527804',
    50
);

-- 3. Tester l'appel avec 4 paramètres (signature attendue par le backend)
SELECT 
    'Test 4 parametres' as test_type,
    COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant',
    '4.332778557312556,9.169371770309054|3.5546023108516125,9.869750188277804|4.253351169137149,10.377867864059054|4.395766768897358,9.891722844527804',
    50,
    100
);

-- 4. Vérifier s'il y a d'autres fonctions avec le même nom
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    p.oid as function_oid
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname LIKE '%search_services_gps%'
ORDER BY p.proname, p.oid; 
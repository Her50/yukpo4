-- ============================================================
-- VÉRIFICATION ET TEST COMPLET DE search_services_gps_final
-- ============================================================

-- 1. VÉRIFIER LA SIGNATURE DE LA FONCTION
-- ============================================================
SELECT 
    '=== 1. VÉRIFICATION SIGNATURE ===' as section;

SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'search_services_gps_final'
AND n.nspname = 'public';

-- 2. VÉRIFIER QUE DEFAULT NULL EST PRÉSENT
-- ============================================================
SELECT 
    '=== 2. VÉRIFICATION DEFAULT NULL ===' as section;

SELECT 
    CASE 
        WHEN pg_get_functiondef(oid) LIKE '%user_gps_zone text DEFAULT NULL%' 
        THEN '✅ Signature correcte avec DEFAULT NULL'
        ELSE '❌ Signature INCORRECTE - DEFAULT NULL manquant'
    END as signature_status
FROM pg_proc
WHERE proname = 'search_services_gps_final'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY oid DESC
LIMIT 1;

-- 3. TEST 1: Appeler avec NULL (doit fonctionner sans erreur)
-- ============================================================
SELECT 
    '=== 3. TEST 1: Avec NULL (sans GPS) ===' as section;

SELECT 
    COUNT(*) as nombre_resultats,
    'Test avec NULL réussi' as status
FROM search_services_gps_final('vêtements', NULL, 50, 10);

-- 4. TEST 2: Appeler avec une zone GPS valide
-- ============================================================
SELECT 
    '=== 4. TEST 2: Avec zone GPS ===' as section;

SELECT 
    COUNT(*) as nombre_resultats,
    'Test avec GPS réussi' as status
FROM search_services_gps_final('vêtements', '4.0301206,9.818945', 50, 10);

-- 5. TEST 3: Vérifier les colonnes retournées
-- ============================================================
SELECT 
    '=== 5. TEST 3: Vérification colonnes retournées ===' as section;

SELECT 
    service_id,
    titre_service,
    category,
    gps_coords,
    distance_km,
    relevance_score,
    gps_source
FROM search_services_gps_final('vêtements', NULL, 50, 5)
LIMIT 3;

-- 6. TEST 4: Vérifier que la structure est correcte
-- ============================================================
SELECT 
    '=== 6. TEST 4: Structure complète ===' as section;

SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ La fonction retourne des résultats'
        ELSE '⚠️ Aucun résultat (normal si pas de données)'
    END as test_result
FROM search_services_gps_final('test', NULL, 50, 1);

-- 7. AFFICHER LA DÉFINITION COMPLÈTE
-- ============================================================
SELECT 
    '=== 7. DÉFINITION COMPLÈTE ===' as section;

SELECT 
    substring(pg_get_functiondef(oid), 1, 500) as definition_start
FROM pg_proc
WHERE proname = 'search_services_gps_final'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY oid DESC
LIMIT 1;

SELECT 
    '✅ VÉRIFICATION TERMINÉE' as final_status;

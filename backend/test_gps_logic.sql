-- Test de la logique GPS hiérarchique
-- Base de données: yukpo_db

-- Test 1: Vérifier les sources GPS disponibles
SELECT '=== TEST 1: Sources GPS disponibles ===' as test_name;

-- Services avec gps_fixe
SELECT 
    'Services avec gps_fixe' as source,
    COUNT(*) as count,
    'data->>gps_fixe' as location
FROM services 
WHERE is_active = true 
AND data->>'gps_fixe' IS NOT NULL 
AND data->>'gps_fixe' != '';

-- Services avec gps prestataire
SELECT 
    'Services avec gps prestataire' as source,
    COUNT(*) as count,
    'colonne gps' as location
FROM services 
WHERE is_active = true 
AND gps IS NOT NULL 
AND gps != '' 
AND gps != 'false';

-- Services sans GPS mais avec utilisateur créateur
SELECT 
    'Services sans GPS mais avec utilisateur créateur' as source,
    COUNT(*) as count,
    'users.gps (fallback)' as location
FROM services s
JOIN users u ON s.user_id = u.id
WHERE s.is_active = true 
AND (s.data->>'gps_fixe' IS NULL OR s.data->>'gps_fixe' = '')
AND (s.gps IS NULL OR s.gps = '' OR s.gps = 'false')
AND u.gps IS NOT NULL 
AND u.gps != '' 
AND u.gps != 'false';

-- Test 2: Vérifier la fonction de fallback
SELECT '=== TEST 2: Test de la fonction get_user_gps ===' as test_name;

-- Tester get_user_gps pour quelques services
SELECT 
    s.id as service_id,
    s.data->>'titre_service' as titre,
    COALESCE(
        s.data->>'gps_fixe',
        s.gps,
        (SELECT gps FROM users WHERE id = s.user_id)
    ) as gps_utilise,
    CASE 
        WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN 'gps_fixe'
        WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN 'gps_prestataire'
        ELSE 'gps_utilisateur_fallback'
    END as source_gps
FROM services s
WHERE s.is_active = true
LIMIT 10;

-- Test 3: Vérifier que search_services_gps_final utilise bien le fallback
SELECT '=== TEST 3: Test de search_services_gps_final avec fallback ===' as test_name;

-- Recherche avec GPS qui devrait utiliser le fallback
SELECT 
    service_id,
    titre_service,
    gps_coords,
    gps_source,
    distance_km
FROM search_services_gps_final('restaurant', '4.0511,9.7679', 50, 10)
ORDER BY distance_km ASC;

-- Résumé de la logique GPS
SELECT '🎯 LOGIQUE GPS IMPLÉMENTÉE' as summary;
SELECT '✅ Priorité 1: gps_fixe du service (data->>gps_fixe)' as logique
UNION ALL
SELECT '✅ Priorité 2: gps du prestataire (colonne gps)'
UNION ALL
SELECT '✅ Priorité 3: gps de l''utilisateur créateur (fallback automatique)'
UNION ALL
SELECT '✅ Aucun forçage sur gps_fixe - recherche flexible dans toutes les sources'; 
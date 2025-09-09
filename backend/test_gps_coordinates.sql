-- TEST DES COORDONNÉES GPS DANS LA BASE DE DONNÉES
-- ================================================

-- 1. Vérifier les coordonnées GPS des services avec gps_fixe
SELECT '=== SERVICES AVEC GPS_FIXE ===' as test_type;
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    s.data->'gps_fixe' as gps_fixe_raw,
    extract_gps_from_json(s.data->'gps_fixe') as gps_fixe_extracted,
    s.gps as gps_prestataire,
    u.gps as gps_utilisateur
FROM services s
LEFT JOIN users u ON s.user_id = u.id
WHERE s.data->'gps_fixe' IS NOT NULL 
   OR s.gps IS NOT NULL 
   OR u.gps IS NOT NULL
LIMIT 10;

-- 2. Tester la fonction search_services_gps_final avec des coordonnées du Cameroun
SELECT '=== TEST FONCTION GPS AVEC COORDONNÉES CAMEROUN ===' as test_type;
SELECT 
    service_id,
    titre_service,
    category,
    gps_coords,
    ROUND(distance_km::NUMERIC, 2) as distance_km,
    gps_source
FROM search_services_gps_final(
    'restaurant',
    '4.051056,9.767869',  -- Douala, Cameroun
    50,
    10
);

-- 3. Tester avec des coordonnées de Yaoundé
SELECT '=== TEST FONCTION GPS AVEC COORDONNÉES YAOUNDÉ ===' as test_type;
SELECT 
    service_id,
    titre_service,
    category,
    gps_coords,
    ROUND(distance_km::NUMERIC, 2) as distance_km,
    gps_source
FROM search_services_gps_final(
    'restaurant',
    '3.848033,11.502075',  -- Yaoundé, Cameroun
    50,
    10
);

-- 4. Vérifier les coordonnées qui pointent vers le Nigeria
SELECT '=== VÉRIFICATION COORDONNÉES NIGERIA ===' as test_type;
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    s.data->'gps_fixe' as gps_fixe_raw,
    extract_gps_from_json(s.data->'gps_fixe') as gps_fixe_extracted,
    s.gps as gps_prestataire,
    u.gps as gps_utilisateur,
    CASE 
        WHEN s.data->'gps_fixe' IS NOT NULL THEN 'gps_fixe'
        WHEN s.gps IS NOT NULL THEN 'gps_prestataire'
        WHEN u.gps IS NOT NULL THEN 'gps_utilisateur'
        ELSE 'aucun'
    END as source_gps
FROM services s
LEFT JOIN users u ON s.user_id = u.id
WHERE 
    (s.data->'gps_fixe' IS NOT NULL AND extract_gps_from_json(s.data->'gps_fixe') ~ '^[0-9]+\.[0-9]+,[0-9]+\.[0-9]+$')
    OR (s.gps IS NOT NULL AND s.gps ~ '^[0-9]+\.[0-9]+,[0-9]+\.[0-9]+$')
    OR (u.gps IS NOT NULL AND u.gps ~ '^[0-9]+\.[0-9]+,[0-9]+\.[0-9]+$')
LIMIT 20;

-- 5. Tester le géocodage inverse avec des coordonnées connues
SELECT '=== TEST GÉOCODAGE INVERSE ===' as test_type;
SELECT 
    'Douala' as ville,
    '4.051056,9.767869' as coordonnees,
    'Cameroun' as pays_attendu;

SELECT 
    'Yaoundé' as ville,
    '3.848033,11.502075' as coordonnees,
    'Cameroun' as pays_attendu;

-- 6. Vérifier la fonction extract_gps_from_json
SELECT '=== TEST EXTRACT_GPS_FROM_JSON ===' as test_type;
SELECT 
    'Test 1' as test,
    extract_gps_from_json('{"valeur": "4.051056,9.767869"}') as resultat,
    '4.051056,9.767869' as attendu;

SELECT 
    'Test 2' as test,
    extract_gps_from_json('{"valeur": "3.848033,11.502075"}') as resultat,
    '3.848033,11.502075' as attendu; 
 
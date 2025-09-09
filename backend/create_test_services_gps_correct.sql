-- Création de services de test avec GPS (structure corrigée)
-- Base de donnees: yukpo_db
-- Objectif: Créer des services avec GPS dans la zone de Douala

SELECT '=== CRÉATION DE SERVICES DE TEST AVEC GPS (STRUCTURE CORRIGÉE) ===' as test_name;

-- =====================================================
-- ÉTAPE 1: CRÉER DES SERVICES AVEC GPS FIXE DANS DATA
-- =====================================================

SELECT '--- ÉTAPE 1: Création services avec GPS fixe dans data ---' as etape;

-- Service 1: Restaurant au centre de Douala
INSERT INTO services (user_id, data, gps, is_active, created_at, updated_at)
VALUES (
    1, 
    '{"titre_service": {"valeur": "Restaurant Le Douala Gourmet", "type_donnee": "string"}, "description": {"valeur": "Restaurant traditionnel camerounais au cœur de Douala", "type_donnee": "string"}, "category": {"valeur": "Restauration", "type_donnee": "string"}, "gps_fixe": {"valeur": "4.0511,9.7679", "type_donnee": "gps"}}'::jsonb,
    '4.0511,9.7679', -- Centre de Douala
    true,
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;

-- Service 2: Restaurant à Akwa (Douala)
INSERT INTO services (user_id, data, gps, is_active, created_at, updated_at)
VALUES (
    1, 
    '{"titre_service": {"valeur": "Pizzeria Akwa Express", "type_donnee": "string"}, "description": {"valeur": "Pizzeria moderne dans le quartier d''Akwa", "type_donnee": "string"}, "category": {"valeur": "Restauration", "type_donnee": "string"}, "gps_fixe": {"valeur": "4.0487,9.7736", "type_donnee": "gps"}}'::jsonb,
    '4.0487,9.7736', -- Akwa, Douala
    true,
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;

-- Service 3: Restaurant à Bonanjo (Douala)
INSERT INTO services (user_id, data, gps, is_active, created_at, updated_at)
VALUES (
    1, 
    '{"titre_service": {"valeur": "Café Bonanjo", "type_donnee": "string"}, "description": {"valeur": "Café élégant dans le quartier des affaires de Bonanjo", "type_donnee": "string"}, "category": {"valeur": "Restauration", "type_donnee": "string"}, "gps_fixe": {"valeur": "4.0532,9.7618", "type_donnee": "gps"}}'::jsonb,
    '4.0532,9.7618', -- Bonanjo, Douala
    true,
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;

-- Service 4: Restaurant à Deido (Douala)
INSERT INTO services (user_id, data, gps, is_active, created_at, updated_at)
VALUES (
    1, 
    '{"titre_service": {"valeur": "Grill Deido", "type_donnee": "string"}, "description": {"valeur": "Restaurant de grillades traditionnelles à Deido", "type_donnee": "string"}, "category": {"valeur": "Restauration", "type_donnee": "string"}, "gps_fixe": {"valeur": "4.0498,9.7754", "type_donnee": "gps"}}'::jsonb,
    '4.0498,9.7754', -- Deido, Douala
    true,
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;

-- Service 5: Restaurant à Bali (Douala)
INSERT INTO services (user_id, data, gps, is_active, created_at, updated_at)
VALUES (
    1, 
    '{"titre_service": {"valeur": "Bali Beach Restaurant", "type_donnee": "string"}, "description": {"valeur": "Restaurant avec vue sur la mer à Bali", "type_donnee": "string"}, "category": {"valeur": "Restauration", "type_donnee": "string"}, "gps_fixe": {"valeur": "4.0567,9.7589", "type_donnee": "gps"}}'::jsonb,
    '4.0567,9.7589', -- Bali, Douala
    true,
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;

-- =====================================================
-- ÉTAPE 2: VÉRIFIER LES SERVICES CRÉÉS
-- =====================================================

SELECT '--- ÉTAPE 2: Vérification des services créés ---' as etape;

-- Compter les services créés
SELECT 'Services avec GPS fixe créés' as type, COUNT(*) as total
FROM services 
WHERE data->>'gps_fixe' IS NOT NULL 
AND data->>'gps_fixe' != '' 
AND data->>'gps_fixe' != 'false'
AND is_active = true
UNION ALL
SELECT 'Services avec GPS prestataire créés' as type, COUNT(*) as total
FROM services 
WHERE gps IS NOT NULL 
AND gps != '' 
AND gps != 'false'
AND is_active = true;

-- Afficher les services créés
SELECT 
    id,
    data->>'titre_service' as titre_service,
    data->>'category' as category,
    COALESCE(data->>'gps_fixe', gps) as gps_coords,
    CASE 
        WHEN data->>'gps_fixe' IS NOT NULL THEN 'gps_fixe'
        WHEN gps IS NOT NULL THEN 'gps_prestataire'
        ELSE 'pas_de_gps'
    END as source_gps
FROM services 
WHERE (data->>'gps_fixe' IS NOT NULL AND data->>'gps_fixe' != '' AND data->>'gps_fixe' != 'false')
   OR (gps IS NOT NULL AND gps != '' AND gps != 'false')
ORDER BY id DESC
LIMIT 10;

-- =====================================================
-- ÉTAPE 3: TEST DE LA RECHERCHE GPS APRÈS CRÉATION
-- =====================================================

SELECT '--- ÉTAPE 3: Test de la recherche GPS après création ---' as etape;

-- Test 1: Recherche GPS pure avec point simple
SELECT 'Test 1: Recherche GPS pure (point simple)' as test;
SELECT COUNT(*) as resultats_gps_pure
FROM search_services_gps_final(NULL, '4.05,9.71', 100, 10);

-- Test 2: Recherche "restaurant" + GPS point simple
SELECT 'Test 2: Recherche "restaurant" + GPS (point simple)' as test;
SELECT COUNT(*) as resultats_restaurant_gps
FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 10);

-- Test 3: Détail des résultats avec point simple
SELECT 'Test 3: Détail résultats (point simple)' as test;
SELECT 
    service_id,
    titre_service,
    category,
    gps_coords,
    ROUND(distance_km::NUMERIC, 2) as distance_km_rounded,
    gps_source
FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 5)
ORDER BY distance_km ASC;

-- Test 4: Recherche avec zone polygonale
SELECT 'Test 4: Recherche zone polygonale' as test;
SELECT COUNT(*) as resultats_zone_polygonale
FROM search_services_gps_final(
    'restaurant', 
    '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 
    100, 
    10
);

-- Test 5: Recherche avec zone polygonale (détail)
SELECT 'Test 5: Détail résultats zone polygonale' as test;
SELECT 
    service_id,
    titre_service,
    category,
    gps_coords,
    ROUND(distance_km::NUMERIC, 2) as distance_km_rounded,
    gps_source
FROM search_services_gps_final(
    'restaurant', 
    '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 
    100, 
    5
)
ORDER BY distance_km ASC;

-- =====================================================
-- RÉSUMÉ FINAL
-- =====================================================

SELECT '--- RÉSUMÉ FINAL ---' as etape;

-- Validation finale
SELECT 'VALIDATION FINALE APRÈS CRÉATION' as test;
SELECT 
    'Point simple (4.05,9.71)' as test_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 10)) > 0 
        THEN 'SUCCÈS - Résultats trouvés' 
        ELSE 'ÉCHEC - 0 résultats' 
    END as resultat
UNION ALL
SELECT 
    'Zone polygonale (5 points)' as test_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM search_services_gps_final('restaurant', '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 100, 10)) > 0 
        THEN 'SUCCÈS - Résultats trouvés' 
        ELSE 'ÉCHEC - 0 résultats' 
    END as resultat;

-- Statistiques finales
SELECT 'STATISTIQUES FINALES APRÈS CRÉATION' as info;
SELECT 
    'Total services actifs' as metrique,
    COUNT(*) as valeur
FROM services 
WHERE is_active = true
UNION ALL
SELECT 
    'Services avec GPS fixe' as metrique,
    COUNT(*) as valeur
FROM services 
WHERE is_active = true 
AND data->>'gps_fixe' IS NOT NULL 
AND data->>'gps_fixe' != '' 
AND data->>'gps_fixe' != 'false'
UNION ALL
SELECT 
    'Services avec GPS prestataire' as metrique,
    COUNT(*) as valeur
FROM services 
WHERE is_active = true 
AND gps IS NOT NULL 
AND gps != '' 
AND gps != 'false';

SELECT '=== FIN DE LA CRÉATION ET TEST ===' as fin_test; 
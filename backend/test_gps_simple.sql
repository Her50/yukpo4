-- Test simple pour comprendre le probleme GPS
SELECT '=== TEST GPS SIMPLE ===' as test_name;

-- Test 1: Services avec GPS
SELECT 'Services avec GPS' as type, COUNT(*) as total
FROM services 
WHERE is_active = true 
AND gps IS NOT NULL 
AND gps != '' 
AND gps != 'false';

-- Test 2: Services avec gps_fixe
SELECT 'Services avec gps_fixe' as type, COUNT(*) as total
FROM services 
WHERE is_active = true 
AND data->>'gps_fixe' IS NOT NULL;

-- Test 3: Utilisateurs avec GPS
SELECT 'Utilisateurs avec GPS' as type, COUNT(*) as total
FROM users 
WHERE gps IS NOT NULL 
AND gps != '';

-- Test 4: Coordonnees utilisateur 1
SELECT 'Coordonnees utilisateur 1' as type, gps
FROM users WHERE id = 1;

-- Test 5: Test recherche simple
SELECT 'Recherche simple' as type, COUNT(*) as total
FROM services 
WHERE is_active = true 
AND data->>'titre_service' ILIKE '%restaurant%'; 
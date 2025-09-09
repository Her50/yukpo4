-- Analyse complete de tous les champs GPS possibles
-- Base de donnees: yukpo_db

SELECT '=== ANALYSE COMPLETE CHAMPS GPS ===' as test_name;

-- Test 1: Verifier la structure des services avec GPS
SELECT '1. Services avec GPS dans le champ gps' as analyse, 
       COUNT(*) as total
FROM services 
WHERE is_active = true 
AND gps IS NOT NULL 
AND gps != '' 
AND gps != 'false';

-- Test 2: Verifier la structure des services avec gps_fixe
SELECT '2. Services avec gps_fixe dans data' as analyse, 
       COUNT(*) as total
FROM services 
WHERE is_active = true 
AND data->>'gps_fixe' IS NOT NULL;

-- Test 3: Verifier la structure des services avec gps_fixe->valeur
SELECT '3. Services avec gps_fixe->valeur dans data' as analyse, 
       COUNT(*) as total
FROM services 
WHERE is_active = true 
AND data->'gps_fixe'->>'valeur' IS NOT NULL;

-- Test 4: Verifier les coordonnees GPS des utilisateurs
SELECT '4. Utilisateurs avec GPS' as analyse, 
       COUNT(*) as total
FROM users 
WHERE gps IS NOT NULL 
AND gps != '';

-- Test 5: Analyser un service specifique avec GPS
SELECT '5. Exemple service avec GPS' as analyse, 
       id,
       data->>'titre_service' as titre,
       gps,
       data->>'gps_fixe' as gps_fixe,
       data->'gps_fixe'->>'valeur' as gps_fixe_valeur
FROM services 
WHERE is_active = true 
AND (gps IS NOT NULL OR data->>'gps_fixe' IS NOT NULL)
LIMIT 3;

-- Test 6: Analyser un utilisateur avec GPS
SELECT '6. Exemple utilisateur avec GPS' as analyse, 
       id,
       email,
       gps
FROM users 
WHERE gps IS NOT NULL 
AND gps != ''
LIMIT 3;

-- Test 7: Verifier les coordonnees Douala vs Nigeria
SELECT '7. Coordonnees Douala vs Nigeria' as analyse,
       CASE 
           WHEN gps LIKE '4.%' AND gps LIKE '%,9.%' THEN 'Zone Douala'
           WHEN gps LIKE '9.%' AND gps LIKE '%,4.%' THEN 'Zone Nigeria'
           ELSE 'Autre zone'
       END as zone,
       COUNT(*) as total
FROM users 
WHERE gps IS NOT NULL 
AND gps != ''
GROUP BY 
    CASE 
        WHEN gps LIKE '4.%' AND gps LIKE '%,9.%' THEN 'Zone Douala'
        WHEN gps LIKE '9.%' AND gps LIKE '%,4.%' THEN 'Zone Nigeria'
        ELSE 'Autre zone'
    END;

-- Test 8: Test de recherche GPS avec zone utilisateur reelle
SELECT '8. Test recherche avec zone utilisateur reelle' as analyse,
       COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195', 
    50, 
    20
);

SELECT '=== FIN ANALYSE ===' as summary; 
-- Test avec guillemets échappés comme dans le backend
SELECT '=== TEST: GPS avec guillemets échappés ===' as test_name;

-- Test 1: GPS avec guillemets échappés (comme dans les logs du backend)
SELECT 'GPS avec guillemets échappés' as type, COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '"4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695"', 
    50, 
    20
);

-- Test 2: GPS sans guillemets (comme dans nos tests)
SELECT 'GPS sans guillemets' as type, COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695', 
    50, 
    20
);

-- Test 3: Vérifier extract_gps_from_json avec guillemets
SELECT 'extract_gps_from_json avec guillemets' as type, COUNT(*) as points
FROM extract_gps_from_json('"4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695"'); 
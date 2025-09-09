-- Test de la fonction extract_gps_coordinates cassée
SELECT '=== TEST: extract_gps_coordinates cassée ===' as test_name;

-- Test 1: Point simple
SELECT 'Point simple' as type, COUNT(*) as points
FROM extract_gps_coordinates('4.05,9.71');

-- Test 2: Polygone complexe
SELECT 'Polygone complexe' as type, COUNT(*) as points
FROM extract_gps_coordinates('4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695');

-- Test 3: Comparaison avec extract_gps_from_json (qui fonctionne)
SELECT 'extract_gps_from_json (contrôle)' as type, COUNT(*) as points
FROM extract_gps_from_json('4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695'); 
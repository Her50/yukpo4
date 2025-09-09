-- Test avec les toutes nouvelles coordonnées GPS de l'utilisateur
SELECT '=== TEST: Nouvelles coordonnées GPS utilisateur ===' as test_name;

-- Test 1: Vérifier extract_gps_coordinates avec nouvelles coordonnées
SELECT 'extract_gps_coordinates (nouvelles coordonnées)' as type, COUNT(*) as points
FROM extract_gps_coordinates('4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195');

-- Test 2: Vérifier search_services_gps_final avec nouvelles coordonnées
SELECT 'search_services_gps_final (nouvelles coordonnées)' as type, COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195', 
    50, 
    20
);

-- Test 3: Vérifier fast_text_gps_search_with_user_fallback avec nouvelles coordonnées
SELECT 'fast_text_gps_search_with_user_fallback (nouvelles coordonnées)' as type, COUNT(*) as resultats
FROM fast_text_gps_search_with_user_fallback(
    'restaurant', 
    '4.322555546124392,9.431292696669695|3.7732417319535783,9.782855196669695|3.9417737800806116,10.161883516982195|4.328033065299631,10.084979220107195', 
    50, 
    20
);

-- Test 4: Vérifier que les anciennes coordonnées fonctionnent toujours
SELECT 'Anciennes coordonnées (contrôle)' as type, COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695', 
    50, 
    20
); 
-- Test des fonctions fast_gps_search_with_user_fallback
SELECT '=== TEST: Fonctions fast_gps_search ===' as test_name;

-- Test 1: fast_text_gps_search_with_user_fallback (avec requête)
SELECT 'fast_text_gps_search_with_user_fallback' as type, COUNT(*) as resultats
FROM fast_text_gps_search_with_user_fallback(
    'restaurant', 
    '4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695', 
    50, 
    20
);

-- Test 2: fast_gps_search_with_user_fallback (sans requête)
SELECT 'fast_gps_search_with_user_fallback' as type, COUNT(*) as resultats
FROM fast_gps_search_with_user_fallback(
    '4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695', 
    50, 
    20
);

-- Test 3: Vérifier que search_services_gps_final appelle bien ces fonctions
SELECT 'search_services_gps_final (contrôle)' as type, COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695', 
    50, 
    20
); 
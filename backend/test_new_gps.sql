-- Test avec les nouvelles coordonnées GPS de l'utilisateur
SELECT '=== TEST: Nouvelles coordonnées GPS utilisateur ===' as test_name;

-- Test 1: Vérifier extract_gps_from_json avec nouvelles coordonnées
SELECT 'Nouvelles coordonnées' as type, COUNT(*) as points
FROM extract_gps_from_json('4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695');

-- Test 2: Vérifier search_services_gps_final avec nouvelles coordonnées
SELECT 'Recherche avec nouvelles coordonnées' as type, COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695', 
    50, 
    20
);

-- Test 3: Vérifier que les anciennes coordonnées fonctionnent toujours
SELECT 'Anciennes coordonnées (contrôle)' as type, COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.318447380764929,9.39421383924782|3.900671496020994,9.513690157607195|3.7663901342151913,9.78972165174782|4.029451836036109,10.17424313612282|4.317077987367724,9.88585202284157', 
    50, 
    20
); 
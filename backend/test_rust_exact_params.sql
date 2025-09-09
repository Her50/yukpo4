-- Test exact des paramètres envoyés par le backend Rust
SELECT '=== TEST: Paramètres exacts backend Rust ===' as test_name;

-- Test 1: GPS avec guillemets échappés exactement comme dans les logs
-- Format: "4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695
SELECT 'GPS avec guillemets échappés (exact)' as type, COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695', 
    50, 
    20
);

-- Test 2: Vérifier que extract_gps_from_json fonctionne avec ces coordonnées
SELECT 'extract_gps_from_json (nouvelles coordonnées)' as type, COUNT(*) as points
FROM extract_gps_from_json('4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695');

-- Test 3: Vérifier que fast_text_gps_search_with_user_fallback fonctionne
SELECT 'fast_text_gps_search_with_user_fallback (nouvelles coordonnées)' as type, COUNT(*) as resultats
FROM fast_text_gps_search_with_user_fallback(
    'restaurant', 
    '4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695', 
    50, 
    20
);

-- Test 4: Vérifier la structure de retour
SELECT 'Structure de retour' as type, COUNT(*) as colonnes
FROM information_schema.columns 
WHERE table_name = 'search_services_gps_final' 
AND column_name IN ('service_id', 'titre_service', 'category', 'gps_coords', 'distance_km', 'relevance_score', 'gps_source'); 
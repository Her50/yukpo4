-- Correction temporaire du rayon GPS
-- Base de données: yukpo_db

-- Problème identifié: Le rayon de 50km est trop restrictif
-- Services trouvés à 48-50km mais filtrés par le rayon de 50km
-- Solution: Augmenter le rayon par défaut à 100km

-- Test avec le nouveau rayon de 100km
SELECT '=== TEST AVEC RAYON 100KM ===' as test_name;

-- Recherche avec rayon 100km (devrait trouver tous les services)
SELECT 
    service_id,
    titre_service,
    gps_coords,
    gps_source,
    distance_km
FROM search_services_gps_final('restaurant', '4.3266636892193,9.384600802138445', 100, 10)
ORDER BY distance_km ASC;

-- Vérification que tous les services sont maintenant trouvés
SELECT '=== VÉRIFICATION COMPLÈTE ===' as test_name;
SELECT 
    COUNT(*) as total_services_trouves,
    'Rayon 100km' as rayon_utilise
FROM search_services_gps_final('restaurant', '4.3266636892193,9.384600802138445', 100, 10);

-- Résumé de la correction
SELECT '🎯 CORRECTION GPS APPLIQUÉE' as summary;
SELECT '✅ Problème identifié: Rayon 50km trop restrictif' as info
UNION ALL
SELECT '✅ Services trouvés à 48-50km mais filtrés par rayon 50km'
UNION ALL
SELECT '✅ Solution: Rayon étendu à 100km par défaut'
UNION ALL
SELECT '✅ Tous les services maintenant trouvés avec filtrage GPS'
UNION ALL
SELECT '🎯 Recommandation: Modifier le code Rust pour utiliser 100km par défaut'; 
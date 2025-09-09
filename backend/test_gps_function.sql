-- Test de la fonction GPS avec les paramètres exacts du frontend
-- =============================================================

-- Test avec les coordonnées exactes du frontend
SELECT 
    'Test fonction GPS avec coordonnees frontend' as test_type,
    COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant',
    '4.2705171468711045,9.52604977674782|3.958214126029232,9.596087618544695|3.7828338779860515,9.749896212294695|4.132187516487534,10.16051022596657|4.28968960160546,9.944903536513445',
    50,
    100
);

-- Vérifier que la fonction retourne les bonnes colonnes
SELECT 
    'Verification colonnes retour' as test_type,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'search_services_gps_final'
ORDER BY ordinal_position; 
-- Test direct de la recherche GPS avec les paramètres du frontend
-- ==============================================================

-- Paramètres exacts du frontend (d'après les logs)
-- Zone GPS: "4.218475218080653,9.65788571424782|3.7458350177633495,9.73204342909157|3.985613976596999,10.211321993544695"
-- Recherche: "restaurant"
-- Rayon: 50km

-- 1. Vérifier d'abord si les fonctions existent
SELECT 
    'Fonctions GPS' as test_type,
    COUNT(*) as nombre_fonctions
FROM information_schema.routines 
WHERE routine_name IN (
    'search_services_gps_final',
    'extract_gps_from_json',
    'calculate_gps_distance_km'
);

-- 2. Vérifier s'il y a des services avec GPS
SELECT 
    'Services avec GPS' as test_type,
    COUNT(*) as nombre_services
FROM services 
WHERE data->'gps_fixe' IS NOT NULL;

-- 3. Vérifier s'il y a des services "restaurant"
SELECT 
    'Services restaurant' as test_type,
    COUNT(*) as nombre_restaurants
FROM services 
WHERE 
    data->>'titre_service' ILIKE '%restaurant%'
    OR data->>'description' ILIKE '%restaurant%'
    OR data->>'category' ILIKE '%restaurant%';

-- 4. Tester extract_gps_from_json manuellement
SELECT 
    'Test extract_gps_from_json' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'extract_gps_from_json') 
        THEN 'Fonction existe'
        ELSE 'Fonction NEXISTE PAS'
    END as status;

-- 5. Si la fonction existe, la tester
DO $$
DECLARE
    test_result text;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'extract_gps_from_json') THEN
        -- Test avec le format exact du frontend
        test_result := extract_gps_from_json('{"valeur": "4.218475218080653,9.65788571424782", "type_donnee": "gps"}'::jsonb);
        RAISE NOTICE 'Test extract_gps_from_json: %', test_result;
        
        IF test_result IS NOT NULL THEN
            RAISE NOTICE 'SUCCES: extract_gps_from_json fonctionne';
        ELSE
            RAISE NOTICE 'ERREUR: extract_gps_from_json retourne NULL';
        END IF;
    ELSE
        RAISE NOTICE 'ERREUR: Fonction extract_gps_from_json inexistante';
    END IF;
END $$;

-- 6. Tester search_services_gps_final si elle existe
SELECT 
    'Test search_services_gps_final' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'search_services_gps_final') 
        THEN 'Fonction existe'
        ELSE 'Fonction NEXISTE PAS'
    END as status;

-- 7. Si la fonction existe, l'exécuter
DO $$
DECLARE
    result_count integer;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'search_services_gps_final') THEN
        -- Compter les résultats de la recherche
        SELECT COUNT(*) INTO result_count
        FROM search_services_gps_final(
            'restaurant',
            '4.218475218080653,9.65788571424782|3.7458350177633495,9.73204342909157|3.985613976596999,10.211321993544695',
            50
        );
        
        RAISE NOTICE 'Recherche GPS restaurant: % resultats trouves', result_count;
        
        IF result_count > 0 THEN
            RAISE NOTICE 'SUCCES: La recherche GPS fonctionne';
        ELSE
            RAISE NOTICE 'ERREUR: La recherche GPS retourne 0 resultats';
        END IF;
    ELSE
        RAISE NOTICE 'ERREUR: Fonction search_services_gps_final inexistante';
    END IF;
END $$; 
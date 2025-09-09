-- Vérification simple de l'existence des fonctions GPS
-- ===================================================

-- 1. Vérifier si les fonctions existent
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'search_services_gps_final',
    'extract_gps_from_json',
    'calculate_gps_distance_km'
)
ORDER BY routine_name;

-- 2. Vérifier s'il y a des services avec GPS
SELECT COUNT(*) as services_avec_gps 
FROM services 
WHERE data->'gps_fixe' IS NOT NULL;

-- 3. Tester extract_gps_from_json si elle existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'extract_gps_from_json') THEN
        RAISE NOTICE 'Fonction extract_gps_from_json existe';
        
        -- Test avec un objet JSONB
        PERFORM extract_gps_from_json('{"valeur": "4.0511,9.7679", "type_donnee": "gps"}'::jsonb);
        RAISE NOTICE 'Test extract_gps_from_json reussi';
    ELSE
        RAISE NOTICE 'Fonction extract_gps_from_json NEXISTE PAS';
    END IF;
END $$; 
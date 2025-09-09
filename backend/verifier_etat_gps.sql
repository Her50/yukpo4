-- Vérification de l'état actuel des fonctions GPS et des données
-- =============================================================

-- 1. Vérifier si les fonctions GPS existent
SELECT 
    routine_name,
    routine_type,
    routine_definition IS NOT NULL as has_definition
FROM information_schema.routines 
WHERE routine_name IN (
    'search_services_gps_final',
    'extract_gps_coordinates', 
    'extract_gps_from_json',
    'fast_gps_search_with_user_fallback',
    'fast_text_gps_search_with_user_fallback',
    'get_user_gps',
    'calculate_gps_distance_km',
    'calculate_intelligent_radius'
)
ORDER BY routine_name;

-- 2. Vérifier la structure de la table services
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'services' 
ORDER BY ordinal_position;

-- 3. Vérifier s'il y a des services avec des données GPS
SELECT 
    id,
    data->>'titre_service' as titre,
    data->>'category' as categorie,
    data->'gps_fixe' as gps_data,
    jsonb_typeof(data->'gps_fixe') as gps_type
FROM services 
WHERE data->'gps_fixe' IS NOT NULL
LIMIT 5;

-- 4. Compter le nombre total de services
SELECT COUNT(*) as total_services FROM services;

-- 5. Compter les services avec GPS
SELECT COUNT(*) as services_avec_gps 
FROM services 
WHERE data->'gps_fixe' IS NOT NULL;

-- 6. Tester extract_gps_from_json sur un service existant
SELECT 
    id,
    data->>'titre_service' as titre,
    extract_gps_from_json(data->'gps_fixe') as gps_extrait
FROM services 
WHERE data->'gps_fixe' IS NOT NULL
LIMIT 3;

-- 7. Test rapide de search_services_gps_final avec un point simple
SELECT 
    'Test point simple' as test_type,
    search_services_gps_final(
        'restaurant', 
        '4.0511,9.7679', -- Douala centre
        50
    ) as resultat; 
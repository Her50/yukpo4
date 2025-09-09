-- DIAGNOSTIC GPS - Vérifier les données et le filtrage

-- 1. Nombre total de services actifs
SELECT COUNT(*) as total_services FROM services WHERE is_active = true;

-- 2. Services avec coordonnées GPS
SELECT 
    id,
    data->>'titre_service' as titre,
    gps,
    data->>'gps_fixe' as gps_fixe,
    category
FROM services 
WHERE is_active = true 
AND (
    (gps IS NOT NULL AND gps != '') OR 
    (data->>'gps_fixe' IS NOT NULL AND data->>'gps_fixe' != '')
)
LIMIT 10;

-- 3. Test de la fonction extract_gps_coordinates
SELECT extract_gps_coordinates('4.0511,9.7679') as test_coords;

-- 4. Test de la fonction calculate_gps_distance_km
SELECT calculate_gps_distance_km(4.0511, 9.7679, 4.0512, 9.7680) as test_distance;

-- 5. Test de recherche GPS avec la zone utilisateur
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    s.gps,
    s.data->>'gps_fixe' as gps_fixe,
    CASE 
        WHEN s.data->>'gps_fixe' IS NOT NULL THEN
            (SELECT calculate_gps_distance_km(
                (SELECT AVG(lat)::DECIMAL FROM extract_gps_coordinates('4.31160038907942,9.392840548232195|3.958214126029232,9.52330319471657|3.8787494544173513,10.11931149549782|4.33214117867583,10.093218966200945')), 
                (SELECT AVG(lng)::DECIMAL FROM extract_gps_coordinates('4.31160038907942,9.392840548232195|3.958214126029232,9.52330319471657|3.8787494544173513,10.11931149549782|4.33214117867583,10.093218966200945')), 
                g.lat, g.lng
            )
            FROM extract_gps_coordinates(s.data->>'gps_fixe') g LIMIT 1)
        WHEN s.gps IS NOT NULL THEN
            (SELECT calculate_gps_distance_km(
                (SELECT AVG(lat)::DECIMAL FROM extract_gps_coordinates('4.31160038907942,9.392840548232195|3.958214126029232,9.52330319471657|3.8787494544173513,10.11931149549782|4.33214117867583,10.093218966200945')), 
                (SELECT AVG(lng)::DECIMAL FROM extract_gps_coordinates('4.31160038907942,9.392840548232195|3.958214126029232,9.52330319471657|3.8787494544173513,10.11931149549782|4.33214117867583,10.093218966200945')), 
                g.lat, g.lng
            )
            FROM extract_gps_coordinates(s.gps) g LIMIT 1)
        ELSE NULL
    END as distance_km
FROM services s
WHERE s.is_active = true 
AND (
    (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '') OR
    (s.gps IS NOT NULL AND s.gps != '')
)
LIMIT 5; 
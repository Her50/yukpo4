-- Vérifier s'il y a de vraies coordonnées GPS
SELECT 
    id, 
    gps, 
    data->>'gps_fixe' as gps_fixe,
    data->>'titre_service' as titre
FROM services 
WHERE 
    (gps IS NOT NULL AND gps != '' AND gps != 'false' AND gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$')
    OR 
    (data->>'gps_fixe' IS NOT NULL AND data->>'gps_fixe' != '' AND data->>'gps_fixe' != 'false')
LIMIT 10; 
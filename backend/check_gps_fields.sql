-- Vérifier les champs GPS disponibles
SELECT 
    id, 
    gps, 
    data->>'gps_fixe' as gps_fixe, 
    data->>'titre_service' as titre 
FROM services 
WHERE gps IS NOT NULL OR data->>'gps_fixe' IS NOT NULL 
LIMIT 5; 
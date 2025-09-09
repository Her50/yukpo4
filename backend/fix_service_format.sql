-- Script de correction du format des données des services
-- Convertit le format complexe en format simple attendu par le frontend

-- 1. Voir la structure actuelle
SELECT 
    id,
    data->'titre_service'->>'valeur' as titre_simple,
    data->'description'->>'valeur' as description_simple,
    data->'category'->>'valeur' as category_simple
FROM services 
WHERE id IN (531974, 27)
ORDER BY id;

-- 2. Corriger le format pour le service 531974
UPDATE services 
SET data = jsonb_build_object(
    'titre_service', COALESCE(data->'titre_service'->>'valeur', 'Services de plomberie'),
    'description', COALESCE(data->'description'->>'valeur', 'Services complets de plomberie: réparation, installation, maintenance'),
    'category', COALESCE(data->'category'->>'valeur', 'Plomberie'),
    'is_tarissable', true,
    'gps_fixe', 'Garoua, Cameroun'
)
WHERE id = 531974;

-- 3. Corriger le format pour le service 27
UPDATE services 
SET data = jsonb_build_object(
    'titre_service', COALESCE(data->'titre_service'->>'valeur', 'Services de plomberie à Garoua'),
    'description', COALESCE(data->'description'->>'valeur', 'Plombier expérimenté offrant des services de réparation et d''installation dans la ville de Garoua.'),
    'category', COALESCE(data->'category'->>'valeur', 'Plomberie'),
    'is_tarissable', true,
    'gps_fixe', 'Garoua, Cameroun'
)
WHERE id = 27;

-- 4. Vérifier le résultat
SELECT 
    id,
    data->>'titre_service' as titre_service,
    data->>'description' as description,
    data->>'category' as category,
    data->>'is_tarissable' as is_tarissable,
    data->>'gps_fixe' as gps_fixe
FROM services 
WHERE id IN (531974, 27)
ORDER BY id; 
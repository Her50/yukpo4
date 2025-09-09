-- Script de correction des données des services
-- Vérifier et corriger la structure des données JSON

-- 1. Voir la structure actuelle
SELECT 
    id,
    json_typeof(data) as data_type,
    data->>'titre_service' as titre_service,
    data->>'titre' as titre,
    data->>'category' as category,
    data->>'description' as description
FROM services 
WHERE id IN (531974, 27)
ORDER BY id;

-- 2. Voir toutes les clés disponibles dans les données
SELECT 
    id,
    json_object_keys(data) as available_keys
FROM services 
WHERE id IN (531974, 27);

-- 3. Si les données sont mal structurées, les corriger
-- Exemple de correction pour un service plombier
UPDATE services 
SET data = jsonb_set(
    data,
    '{titre_service}',
    '"Services de plomberie professionnelle"'
)
WHERE id = 531974 AND (data->>'titre_service' IS NULL OR data->>'titre_service' = '');

-- 4. Ajouter une description si manquante
UPDATE services 
SET data = jsonb_set(
    data,
    '{description}',
    '"Services complets de plomberie: réparation, installation, maintenance"'
)
WHERE id = 531974 AND (data->>'description' IS NULL OR data->>'description' = '');

-- 5. Ajouter une catégorie si manquante
UPDATE services 
SET data = jsonb_set(
    data,
    '{category}',
    '"Plomberie"'
)
WHERE id = 531974 AND (data->>'category' IS NULL OR data->>'category' = '');

-- 6. Vérifier le résultat
SELECT 
    id,
    data->>'titre_service' as titre_service,
    data->>'description' as description,
    data->>'category' as category
FROM services 
WHERE id IN (531974, 27)
ORDER BY id; 
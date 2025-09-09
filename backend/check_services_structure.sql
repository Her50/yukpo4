-- Analyse de la structure des services existants
-- Vérifier les champs disponibles dans les données JSON

-- 1. Voir quelques exemples de services
SELECT 
    id,
    json_typeof(data) as data_type,
    data->>'titre_service' as titre_service,
    data->>'titre' as titre,
    data->>'description' as description,
    data->>'category' as category,
    data->>'gps_fixe' as gps_fixe,
    created_at
FROM services 
WHERE is_active = true 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Voir toutes les clés disponibles dans les données JSON
SELECT DISTINCT
    json_object_keys(data) as available_keys
FROM services 
WHERE is_active = true
ORDER BY available_keys;

-- 3. Compter les services par catégorie
SELECT 
    COALESCE(data->>'category', 'Non définie') as category,
    COUNT(*) as count
FROM services 
WHERE is_active = true
GROUP BY data->>'category'
ORDER BY count DESC;

-- 4. Vérifier les services avec des données structurées
SELECT 
    id,
    data->'titre_service'->>'valeur' as titre_simple,
    data->'description'->>'valeur' as description_simple,
    data->'category'->>'valeur' as category_simple
FROM services 
WHERE is_active = true 
AND data->'titre_service'->>'valeur' IS NOT NULL
LIMIT 5; 
-- Script pour corriger la catégorie du service 170
-- Change "Services" vers "Services automobiles" pour qu'il apparaisse dans les recherches

UPDATE services 
SET data = jsonb_set(
    data, 
    '{category,valeur}', 
    '"Services automobiles"'
)
WHERE id = 170;

-- Vérifier la modification
SELECT id, data->'category'->>'valeur' as category 
FROM services 
WHERE id = 170; 
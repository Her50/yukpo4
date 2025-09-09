-- Services en attente de vectorisation
SELECT 
    id,
    data->>'titre_service' as titre,
    (data->'description'->>'valeur') as description,
    (data->'category'->>'valeur') as category
FROM services 
WHERE embedding_status = 'pending'
ORDER BY created_at DESC 
LIMIT 5; 
-- Vérification du statut d'embedding des services
SELECT 
    embedding_status,
    COUNT(*) as count
FROM services 
GROUP BY embedding_status;

-- Services avec embedding_status = 'pending'
SELECT 
    id,
    data->>'titre_service' as titre,
    data->>'category'->>'valeur' as category,
    embedding_status,
    embedding_error,
    embedding_last_attempt
FROM services 
WHERE embedding_status = 'pending'
ORDER BY created_at DESC 
LIMIT 10; 
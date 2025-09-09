-- Vérifier l'état des services manquants
-- Services qui retournent 404 dans les logs

-- 1. Vérifier l'existence des services
SELECT 
    id,
    is_active,
    created_at,
    user_id,
    CASE 
        WHEN data->>'titre_service' IS NOT NULL THEN data->>'titre_service'
        WHEN data->>'titre' IS NOT NULL THEN data->>'titre'
        ELSE 'Pas de titre'
    END as titre
FROM services 
WHERE id IN (974024, 20977, 862419, 939282, 518829, 742692)
ORDER BY id;

-- 2. Vérifier les services récents (créés après 2024)
SELECT 
    id,
    is_active,
    created_at,
    user_id,
    CASE 
        WHEN data->>'titre_service' IS NOT NULL THEN data->>'titre_service'
        WHEN data->>'titre' IS NOT NULL THEN data->>'titre'
        ELSE 'Pas de titre'
    END as titre
FROM services 
WHERE created_at > '2024-01-01'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Vérifier les services inactifs
SELECT 
    id,
    is_active,
    created_at,
    user_id
FROM services 
WHERE is_active = false
ORDER BY created_at DESC
LIMIT 10;

-- 4. Vérifier le service 974024 spécifiquement (créé récemment)
SELECT 
    id,
    is_active,
    created_at,
    user_id,
    data->>'titre_service' as titre_service,
    data->>'description' as description,
    data->>'category' as category
FROM services 
WHERE id = 974024; 
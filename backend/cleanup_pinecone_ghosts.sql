-- Script pour identifier les services réels vs fantômes
-- Utilisé pour nettoyer Pinecone des embeddings de services inexistants

-- 1. Services qui existent réellement en base (actifs)
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
WHERE is_active = true
ORDER BY id;

-- 2. Services qui existent mais sont inactifs
SELECT 
    id,
    is_active,
    created_at,
    user_id
FROM services 
WHERE is_active = false
ORDER BY id;

-- 3. Liste des IDs de services valides pour Pinecone
SELECT 
    string_agg(id::text, ',') as valid_service_ids
FROM services 
WHERE is_active = true;

-- 4. Vérifier les services récents créés aujourd'hui
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
WHERE DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC; 
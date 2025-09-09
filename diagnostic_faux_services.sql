-- Diagnostic des faux services dans la table services
-- Script pour identifier les services qui contiennent des données de recherche

-- 1. Compter les services avec origine_champs = "recherche_directe"
SELECT 
    'Services avec recherche_directe' as type,
    COUNT(*) as count
FROM services 
WHERE data::text LIKE '%recherche_directe%';

-- 2. Afficher les premiers services problématiques
SELECT 
    id,
    user_id,
    data->>'titre' as titre_brut,
    data->'titre'->>'valeur' as titre_valeur,
    data->'titre'->>'origine_champs' as titre_origine,
    created_at,
    embedding_status
FROM services 
WHERE data::text LIKE '%recherche_directe%'
ORDER BY id 
LIMIT 10;

-- 3. Vérifier spécifiquement le service 559614
SELECT 
    id,
    user_id,
    data,
    created_at,
    embedding_status,
    is_active
FROM services 
WHERE id = 559614;

-- 4. Statistiques générales
SELECT 
    COUNT(*) as total_services,
    COUNT(CASE WHEN data::text LIKE '%origine_champs%' THEN 1 END) as with_origine_champs,
    COUNT(CASE WHEN data::text LIKE '%recherche_directe%' THEN 1 END) as with_recherche_directe,
    COUNT(CASE WHEN data::text NOT LIKE '%origine_champs%' THEN 1 END) as without_origine_champs
FROM services;

-- 5. Les 5 derniers services créés
SELECT 
    id,
    user_id,
    data->'titre'->>'valeur' as titre,
    data->'titre'->>'origine_champs' as origine,
    created_at
FROM services 
ORDER BY created_at DESC 
LIMIT 5; 
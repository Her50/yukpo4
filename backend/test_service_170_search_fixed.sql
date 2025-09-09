-- Test direct de la recherche pour le service 170 (version corrigée)
-- Requête exacte utilisée par le backend

-- 1. Vérifier que le service 170 existe et est actif
SELECT 
    id,
    is_active,
    data->>'titre_service' as titre,
    data->>'description' as description,
    data->'category'->>'valeur' as category
FROM services 
WHERE id = 170;

-- 2. Test de la recherche full-text avec "mécanicien" (syntaxe corrigée)
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    s.data->>'description' as description,
    s.data->'category'->>'valeur' as category,
    (
        COALESCE(ts_rank(
            setweight(to_tsvector('french', COALESCE(s.data->>'titre_service', '')), 'A') ||
            setweight(to_tsvector('french', COALESCE(s.data->>'description', '')), 'B') ||
            setweight(to_tsvector('french', COALESCE(s.data->>'category', '')), 'C'),
            plainto_tsquery('french', 'mécanicien')
        ), 0.0) * 2.0 +
        CASE 
            WHEN s.data->>'titre_service' ILIKE '%mécanicien%' THEN 5.0
            WHEN s.data->>'description' ILIKE '%mécanicien%' THEN 3.0
            WHEN s.data->>'category' ILIKE '%mécanicien%' THEN 2.0
            ELSE 0.0
        END
    ) as fulltext_score
FROM services s
WHERE s.is_active = true
AND (
    to_tsvector('french', COALESCE(s.data->>'titre_service', '')) @@ plainto_tsquery('french', 'mécanicien')
    OR to_tsvector('french', COALESCE(s.data->>'description', '')) @@ plainto_tsquery('french', 'mécanicien')
    OR to_tsvector('french', COALESCE(s.data->>'category', '')) @@ plainto_tsquery('french', 'mécanicien')
    OR s.data->>'titre_service' ILIKE '%mécanicien%'
    OR s.data->>'description' ILIKE '%mécanicien%'
    OR s.data->>'category' ILIKE '%mécanicien%'
)
ORDER BY fulltext_score DESC
LIMIT 50;

-- 3. Test simple avec LIKE pour vérifier si le service 170 correspond
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    s.data->>'description' as description,
    CASE 
        WHEN s.data->>'titre_service' ILIKE '%mécanicien%' THEN 'Titre'
        WHEN s.data->>'description' ILIKE '%mécanicien%' THEN 'Description'
        WHEN s.data->>'category' ILIKE '%mécanicien%' THEN 'Catégorie'
        ELSE 'Aucun'
    END as match_type
FROM services s
WHERE s.is_active = true
AND (
    s.data->>'titre_service' ILIKE '%mécanicien%'
    OR s.data->>'description' ILIKE '%mécanicien%'
    OR s.data->>'category' ILIKE '%mécanicien%'
)
ORDER BY s.id;

-- 4. Vérifier tous les services actifs avec "mécanicien"
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    s.data->>'description' as description,
    s.data->'category'->>'valeur' as category,
    s.created_at
FROM services s
WHERE s.is_active = true
AND (
    s.data->>'titre_service' ILIKE '%mécanicien%'
    OR s.data->>'description' ILIKE '%mécanicien%'
    OR s.data->>'category' ILIKE '%mécanicien%'
)
ORDER BY s.created_at DESC; 
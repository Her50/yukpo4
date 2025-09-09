-- Test direct de la recherche pour le service 170
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

-- 2. Test de la recherche full-text avec "mécanicien"
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    s.data->>'description' as description,
    s.data->'category'->>'valeur' as category,
    (
        COALESCE(ts_rank(
            setweight(to_tsvector('french', COALESCE(s.data->>'titre_service', '')), 'A') * 3.0 +
            setweight(to_tsvector('french', COALESCE(s.data->>'description', '')), 'B') * 2.0 +
            setweight(to_tsvector('french', COALESCE(s.data->>'category', '')), 'C') * 1.5,
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

-- 3. Test avec recherche trigram
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    GREATEST(
        similarity(s.search_trgm, 'mécanicien'),
        similarity(COALESCE(s.data->>'titre_service', ''), 'mécanicien'),
        similarity(COALESCE(s.data->>'description', ''), 'mécanicien'),
        similarity(COALESCE(s.data->>'category', ''), 'mécanicien')
    ) as trigram_score
FROM services s
WHERE s.is_active = true
AND (
    s.search_trgm % 'mécanicien'
    OR COALESCE(s.data->>'titre_service', '') % 'mécanicien'
    OR COALESCE(s.data->>'description', '') % 'mécanicien'
    OR COALESCE(s.data->>'category', '') % 'mécanicien'
)
ORDER BY trigram_score DESC
LIMIT 50; 
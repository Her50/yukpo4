-- Trouver des termes de recherche réels dans la base
-- ===================================================

\echo '=== TERMES DE RECHERCHE DISPONIBLES ==='

-- 1. Titres de services existants
SELECT '1. Titres de services:' as info;
SELECT DISTINCT 
    LEFT(COALESCE(data->'titre_service'->>'valeur', data->>'titre_service', 'Sans titre'), 50) as titre,
    category
FROM services 
WHERE is_active = true
LIMIT 10;

-- 2. Catégories disponibles
SELECT '2. Catégories disponibles:' as info;
SELECT DISTINCT category 
FROM services 
WHERE is_active = true AND category IS NOT NULL
LIMIT 10;

-- 3. Mots-clés fréquents dans les descriptions
SELECT '3. Services avec description:' as info;
SELECT 
    s.id,
    LEFT(COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', 'Sans titre'), 40) as titre,
    LEFT(COALESCE(s.data->'description'->>'valeur', s.data->>'description', ''), 50) as description
FROM services s
WHERE s.is_active = true
AND (s.data->'description'->>'valeur' IS NOT NULL OR s.data->>'description' IS NOT NULL)
LIMIT 5;


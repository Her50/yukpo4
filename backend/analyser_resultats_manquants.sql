-- ============================================================
-- ANALYSE : Pourquoi les recherches ne trouvent pas de résultats
-- ============================================================

\echo '=== 1. Vérifier les données réelles dans la base ==='

-- Voir les titres de services existants
SELECT 
    id,
    COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', 'Sans titre') as titre,
    category,
    is_active
FROM services
WHERE is_active = true
ORDER BY id
LIMIT 20;

\echo ''
\echo '=== 2. Rechercher "photographe" avec LIKE (insensible à la casse) ==='
SELECT 
    id,
    COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '') as titre,
    COALESCE(data->>'description', data->'description'->>'valeur', '') as description
FROM services
WHERE is_active = true
AND (
    COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '') ILIKE '%photographe%'
    OR COALESCE(data->>'description', data->'description'->>'valeur', '') ILIKE '%photographe%'
);

\echo ''
\echo '=== 3. Rechercher "électricien" avec LIKE ==='
SELECT 
    id,
    COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '') as titre
FROM services
WHERE is_active = true
AND (
    COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '') ILIKE '%électricien%'
    OR COALESCE(data->>'description', data->'description'->>'valeur', '') ILIKE '%électricien%'
);

\echo ''
\echo '=== 4. Rechercher "restaurant" avec LIKE ==='
SELECT 
    id,
    COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '') as titre
FROM services
WHERE is_active = true
AND (
    COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '') ILIKE '%restaurant%'
    OR COALESCE(data->>'description', data->'description'->>'valeur', '') ILIKE '%restaurant%'
);

\echo ''
\echo '=== 5. Rechercher "toyota" ou "rav4" avec LIKE ==='
SELECT 
    id,
    COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '') as titre
FROM services
WHERE is_active = true
AND (
    COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '') ILIKE '%toyota%'
    OR COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '') ILIKE '%rav4%'
    OR COALESCE(data->>'description', data->'description'->>'valeur', '') ILIKE '%toyota%'
    OR COALESCE(data->>'description', data->'description'->>'valeur', '') ILIKE '%rav4%'
);

\echo ''
\echo '=== 6. Test full-text search "photographe" ==='
SELECT 
    s.id,
    COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') as titre,
    ts_rank(to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), 
            plainto_tsquery('french', 'photographe')) as rank
FROM services s
WHERE s.is_active = true
AND (
    to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', 'photographe')
    OR to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', 'photographe')
);

\echo ''
\echo '=== 7. Vérifier les produits dans les services ==='
SELECT 
    s.id as service_id,
    COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') as titre_service,
    jsonb_array_length(COALESCE(s.data->'produits', '[]'::jsonb)) as nb_produits,
    CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'array' THEN s.data->'produits'
        ELSE '[]'::jsonb
    END->0->>'nom' as premier_produit_nom
FROM services s
WHERE s.is_active = true
AND s.data->'produits' IS NOT NULL
AND jsonb_array_length(COALESCE(s.data->'produits', '[]'::jsonb)) > 0
LIMIT 10;


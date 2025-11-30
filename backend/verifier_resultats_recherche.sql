-- Vérifier pourquoi les recherches ne trouvent pas de résultats
-- =============================================================

\echo '=== 1. Services avec "photographe" ==='
SELECT id, 
       COALESCE(data->'titre_service'->>'valeur', data->>'titre_service', 'Sans titre') as titre,
       category
FROM services 
WHERE is_active = true
AND (
    COALESCE(data->'titre_service'->>'valeur', data->>'titre_service', '') ILIKE '%photographe%'
    OR COALESCE(data->'description'->>'valeur', data->>'description', '') ILIKE '%photographe%'
)
LIMIT 5;

\echo ''
\echo '=== 2. Services avec "électricien" ==='
SELECT id, 
       COALESCE(data->'titre_service'->>'valeur', data->>'titre_service', 'Sans titre') as titre
FROM services 
WHERE is_active = true
AND (
    COALESCE(data->'titre_service'->>'valeur', data->>'titre_service', '') ILIKE '%électricien%'
    OR COALESCE(data->'description'->>'valeur', data->>'description', '') ILIKE '%électricien%'
)
LIMIT 5;

\echo ''
\echo '=== 3. Services avec "restaurant" ==='
SELECT id, 
       COALESCE(data->'titre_service'->>'valeur', data->>'titre_service', 'Sans titre') as titre
FROM services 
WHERE is_active = true
AND (
    COALESCE(data->'titre_service'->>'valeur', data->>'titre_service', '') ILIKE '%restaurant%'
    OR COALESCE(data->'description'->>'valeur', data->>'description', '') ILIKE '%restaurant%'
)
LIMIT 5;

\echo ''
\echo '=== 4. Services avec "toyota" ou "rav4" ==='
SELECT id, 
       COALESCE(data->'titre_service'->>'valeur', data->>'titre_service', 'Sans titre') as titre
FROM services 
WHERE is_active = true
AND (
    COALESCE(data->'titre_service'->>'valeur', data->>'titre_service', '') ILIKE '%toyota%'
    OR COALESCE(data->'titre_service'->>'valeur', data->>'titre_service', '') ILIKE '%rav4%'
    OR COALESCE(data->'description'->>'valeur', data->>'description', '') ILIKE '%toyota%'
    OR COALESCE(data->'description'->>'valeur', data->>'description', '') ILIKE '%rav4%'
)
LIMIT 5;

\echo ''
\echo '=== 5. Test recherche full-text "photographe" ==='
SELECT s.id, 
       COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre_service', '') as titre
FROM services s
WHERE s.is_active = true
AND (
    to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', 'photographe')
    OR to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', 'photographe')
)
LIMIT 5;


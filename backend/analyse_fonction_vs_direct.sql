-- ============================================================
-- ANALYSE : Pourquoi la fonction est 27x plus lente que la requête directe ?
-- ============================================================

\echo '=== COMPARAISON : Requête directe vs Fonction ==='
\echo ''

\echo '1. Requête DIRECTE (18ms, utilise index):'
EXPLAIN (ANALYZE, BUFFERS)
SELECT s.id, 
       COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') as titre
FROM services s
WHERE s.is_active = true
AND to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', 'photographe')
LIMIT 5;

\echo ''
\echo '2. Fonction (482ms, ne utilise PAS index):'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM search_services_gps_final('photographe', NULL, 50, 5);

\echo ''
\echo '=== ANALYSE : Que fait la fonction en plus ? ==='
\echo 'La fonction fait:'
\echo '  - DISTINCT ON (s.id)'
\echo '  - Calcul de ts_rank (relevance_score)'
\echo '  - ORDER BY s.id, relevance_score DESC'
\echo '  - CTE avec ranked_services'
\echo ''
\echo 'Ces opérations supplémentaires ralentissent la fonction!'

\echo ''
\echo '=== TEST : Requête simplifiée sans DISTINCT ON ==='
EXPLAIN (ANALYZE, BUFFERS)
WITH ranked AS (
    SELECT 
        s.id,
        COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') as titre,
        GREATEST(
            ts_rank(to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', 'photographe')) * 10.0,
            ts_rank(to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), plainto_tsquery('french', 'photographe')) * 5.0,
            0.0
        ) AS score
    FROM services s
    WHERE s.is_active = true
    AND (
        to_tsvector('french', COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', 'photographe')
        OR to_tsvector('french', COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', 'photographe')
    )
)
SELECT DISTINCT ON (id) id, titre, score
FROM ranked
ORDER BY id, score DESC
LIMIT 5;


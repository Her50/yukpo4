-- ============================================================
-- ANALYSE : Format JSON des données
-- ============================================================

\echo '=== PROBLÈME IDENTIFIÉ : Format JSON ==='
\echo 'Les données sont stockées comme:'
\echo '{"valeur": "Services de photographie professionnelle", "type_donnee": "string", "origine_champs": "ia"}'
\echo ''
\echo 'La recherche LIKE ne trouve rien car elle cherche directement dans le JSON!'
\echo ''

\echo '=== TEST : Rechercher avec le bon format ==='
SELECT 
    id,
    data->'titre_service'->>'valeur' as titre_valeur,
    data->>'titre_service' as titre_direct,
    CASE 
        WHEN data->'titre_service' IS NOT NULL THEN 'Structure JSON'
        WHEN data->>'titre_service' IS NOT NULL THEN 'String direct'
        ELSE 'Aucun'
    END as format
FROM services
WHERE is_active = true
LIMIT 10;

\echo ''
\echo '=== VÉRIFIER : Quel format est utilisé pour "photographe" ==='
SELECT 
    id,
    data->'titre_service'->>'valeur' as titre,
    to_tsvector('french', COALESCE(data->'titre_service'->>'valeur', data->>'titre_service', '')) @@ plainto_tsquery('french', 'photographe') as matches
FROM services
WHERE id = 13;

\echo ''
\echo '=== CONCLUSION ==='
\echo 'Le format JSON {"valeur": "..."} nécessite data->''titre_service''->>''valeur'''
\echo 'La fonction utilise déjà COALESCE(data->>''titre_service'', data->''titre_service''->>''valeur'', '''')'
\echo 'Mais peut-être que l''ordre est incorrect ou que les index ne couvrent pas ce format!'


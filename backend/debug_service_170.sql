-- Analyse détaillée du service 170
SELECT 
    id,
    is_active,
    data,
    data->>'titre_service' as titre_service_raw,
    data->'titre_service'->>'valeur' as titre_valeur,
    data->>'description' as description_raw,
    data->'description'->>'valeur' as description_valeur,
    data->'category'->>'valeur' as category_valeur
FROM services 
WHERE id = 170;

-- Test avec les valeurs extraites
SELECT 
    s.id,
    s.data->'titre_service'->>'valeur' as titre,
    s.data->'description'->>'valeur' as description,
    s.data->'category'->>'valeur' as category,
    CASE 
        WHEN s.data->'titre_service'->>'valeur' ILIKE '%mécanicien%' THEN 'Titre'
        WHEN s.data->'description'->>'valeur' ILIKE '%mécanicien%' THEN 'Description'
        WHEN s.data->'category'->>'valeur' ILIKE '%mécanicien%' THEN 'Catégorie'
        ELSE 'Aucun'
    END as match_type
FROM services s
WHERE s.is_active = true
AND (
    s.data->'titre_service'->>'valeur' ILIKE '%mécanicien%'
    OR s.data->'description'->>'valeur' ILIKE '%mécanicien%'
    OR s.data->'category'->>'valeur' ILIKE '%mécanicien%'
)
ORDER BY s.id;

-- Vérifier tous les services avec "mécanicien" dans les valeurs extraites
SELECT 
    s.id,
    s.data->'titre_service'->>'valeur' as titre,
    s.data->'description'->>'valeur' as description,
    s.data->'category'->>'valeur' as category,
    s.created_at
FROM services s
WHERE s.is_active = true
AND (
    s.data->'titre_service'->>'valeur' ILIKE '%mécanicien%'
    OR s.data->'description'->>'valeur' ILIKE '%mécanicien%'
    OR s.data->'category'->>'valeur' ILIKE '%mécanicien%'
)
ORDER BY s.created_at DESC; 
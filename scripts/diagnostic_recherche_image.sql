-- Script de diagnostic pour la recherche par image
-- Vérifie pourquoi hybrid_image_search ne trouve pas de résultats

-- 1. Vérifier si des produits "chaussures" existent dans services.data
SELECT 
    s.id as service_id,
    s.is_active,
    jsonb_array_length(
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END
    ) as nb_produits,
    jsonb_pretty(s.data->'produits') as produits_json
FROM services s
WHERE s.is_active = true
AND (
    s.data->'produits' IS NOT NULL
    OR s.data->'produits'->'valeur' IS NOT NULL
)
AND (
    to_tsvector('french', COALESCE(s.data::text, '')) @@ plainto_tsquery('french', 'chaussures')
    OR s.data::text ILIKE '%chaussures%'
    OR s.data::text ILIKE '%chaussure%'
)
LIMIT 10;

-- 2. Vérifier si ces services ont des images dans media
SELECT 
    s.id as service_id,
    COUNT(m.id) as nb_images,
    COUNT(CASE WHEN m.ai_description IS NOT NULL THEN 1 END) as nb_images_analysees,
    COUNT(CASE WHEN m.ai_description IS NULL THEN 1 END) as nb_images_non_analysees
FROM services s
LEFT JOIN media m ON m.service_id = s.id AND m.type = 'image'
WHERE s.is_active = true
AND (
    s.data::text ILIKE '%chaussures%'
    OR s.data::text ILIKE '%chaussure%'
)
GROUP BY s.id
LIMIT 10;

-- 3. Vérifier les images avec ai_description pour "chaussures"
SELECT 
    m.id as media_id,
    m.service_id,
    m.type,
    m.ai_description,
    m.ai_tags,
    m.ai_category,
    m.ai_metadata,
    s.is_active
FROM media m
INNER JOIN services s ON s.id = m.service_id
WHERE m.type = 'image'
AND m.ai_description IS NOT NULL
AND (
    m.ai_description ILIKE '%chaussures%'
    OR m.ai_description ILIKE '%chaussure%'
    OR m.ai_tags && ARRAY['chaussures', 'chaussure']
)
LIMIT 10;

-- 4. Vérifier si des produits sont dans image_analyses
SELECT 
    ia.id as analysis_id,
    ia.service_id,
    ia.media_id,
    ia.description,
    ia.tags,
    ia.category_detected,
    ia.marque,
    ia.couleurs,
    ia.confiance
FROM image_analyses ia
INNER JOIN services s ON s.id = ia.service_id
WHERE s.is_active = true
AND (
    ia.description ILIKE '%chaussures%'
    OR ia.description ILIKE '%chaussure%'
    OR ia.tags && ARRAY['chaussures', 'chaussure']
)
LIMIT 10;

-- 5. Test de la fonction hybrid_image_search avec les paramètres de recherche
-- Simuler la recherche avec les tags et query générés par l'IA
SELECT * FROM hybrid_image_search(
    ARRAY['chaussures', 'cuir', 'classique', 'bru']::TEXT[],  -- search_tags
    NULL::TEXT,  -- search_category
    NULL::TEXT,  -- search_marque
    'bru'::TEXT,  -- search_couleur
    'Chaussures en cuir de style classique, couleur bru'::TEXT,  -- search_query_semantic
    NULL::FLOAT,  -- gps_lat
    NULL::FLOAT,  -- gps_lng
    50::INTEGER,  -- search_radius_km
    20::INTEGER   -- max_results
);

-- 6. Vérifier le seuil de score (match_score >= 10.0)
-- Calculer le score pour un produit "chaussures" existant
SELECT 
    s.id as service_id,
    m.id as media_id,
    m.ai_description,
    m.ai_tags,
    (
        -- Score tags communs
        (SELECT COUNT(*) * 20.0 FROM unnest(COALESCE(m.ai_tags, ARRAY[]::TEXT[])) tag 
         WHERE tag = ANY(ARRAY['chaussures', 'cuir', 'classique', 'bru']::TEXT[])) +
        -- Score full-text sur description
        COALESCE(
            ts_rank(to_tsvector('french', COALESCE(m.ai_description, '')), 
                    plainto_tsquery('french', 'Chaussures en cuir de style classique, couleur bru')) * 50.0,
            0.0
        ) +
        -- Score ILIKE sur description
        CASE 
            WHEN m.ai_description ILIKE '%Chaussures en cuir de style classique, couleur bru%' THEN 30.0
            ELSE 0.0
        END +
        -- Bonus confiance
        (COALESCE(m.ai_confidence, 0.5) * 20.0)
    )::FLOAT as calculated_score
FROM services s
INNER JOIN media m ON m.service_id = s.id
WHERE s.is_active = true
AND m.type = 'image'
AND m.ai_description IS NOT NULL
AND (
    m.ai_description ILIKE '%chaussures%'
    OR m.ai_description ILIKE '%chaussure%'
)
LIMIT 10;


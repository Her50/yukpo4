-- Script de diagnostic pour la recherche par image
-- Vérifie les données et teste la fonction de recherche

-- 1. Vérifier les médias avec analyse IA
SELECT 
    COUNT(*) as total_media,
    COUNT(CASE WHEN type = 'image' THEN 1 END) as total_images,
    COUNT(CASE WHEN type = 'image' AND ai_description IS NOT NULL THEN 1 END) as images_with_ai,
    COUNT(CASE WHEN type = 'image' AND ai_description IS NOT NULL AND ai_tags IS NOT NULL THEN 1 END) as images_with_tags,
    COUNT(CASE WHEN type = 'image' AND ai_description IS NOT NULL AND normalized_ai_description IS NOT NULL THEN 1 END) as images_with_normalized
FROM media;

-- 2. Exemple de médias avec analyse IA
SELECT 
    m.id,
    m.type,
    m.ai_description,
    m.ai_tags,
    m.ai_category,
    m.normalized_ai_description,
    m.normalized_ai_tags,
    m.ai_confidence,
    s.is_active,
    s.gps
FROM media m
INNER JOIN services s ON s.id = m.service_id
WHERE m.type = 'image' 
  AND m.ai_description IS NOT NULL
LIMIT 5;

-- 3. Vérifier les services actifs avec images
SELECT 
    COUNT(DISTINCT s.id) as active_services_with_images
FROM services s
INNER JOIN media m ON m.service_id = s.id
WHERE s.is_active = true
  AND m.type = 'image'
  AND m.ai_description IS NOT NULL;

-- 4. Tester la fonction avec une requête simple
-- Simuler une recherche pour "chaussure"
SELECT * FROM search_images_by_ai_analysis(
    'chaussure'::TEXT,           -- search_query
    ARRAY['chaussure', 'shoe']::TEXT[],  -- search_tags
    NULL::TEXT,                   -- search_category
    NULL::TEXT,                   -- search_marque
    NULL::TEXT,                   -- search_couleur
    NULL::FLOAT,                  -- gps_lat
    NULL::FLOAT,                  -- gps_lng
    50::INTEGER,                  -- search_radius_km
    20::INTEGER,                  -- max_results
    'french'::TEXT                -- detected_lang
);

-- 5. Vérifier les colonnes normalisées
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'media'
  AND column_name IN ('normalized_ai_description', 'normalized_ai_tags', 'ai_description', 'ai_tags');

-- 6. Vérifier si les fonctions existent
SELECT 
    proname as function_name,
    prorettype::regtype as return_type
FROM pg_proc
WHERE proname IN ('search_images_by_ai_analysis', 'get_text_search_config', 'normalize_text', 'normalize_word_array', 'calculate_vector_match_score_optimized')
ORDER BY proname;

-- 7. Test avec une requête vide pour voir tous les résultats possibles (sans filtre WHERE)
SELECT 
    m.id as media_id,
    s.id as service_id,
    m.ai_description,
    m.normalized_ai_description,
    m.ai_tags,
    m.normalized_ai_tags,
    m.ai_category,
    s.is_active,
    CASE 
        WHEN m.normalized_ai_description IS NULL OR m.normalized_ai_description = '' THEN 'DESC_VIDE'
        ELSE 'DESC_OK'
    END as desc_status,
    CASE 
        WHEN m.normalized_ai_tags IS NULL OR array_length(m.normalized_ai_tags, 1) IS NULL THEN 'TAGS_VIDE'
        ELSE 'TAGS_OK'
    END as tags_status
FROM media m
INNER JOIN services s ON s.id = m.service_id
WHERE s.is_active = true
  AND m.type = 'image'
LIMIT 10;

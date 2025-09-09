-- Vérifier la structure de la table media
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'media' 
ORDER BY ordinal_position;

-- Vérifier si les colonnes d'image existent
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_signature'
    ) THEN 'OUI' ELSE 'NON' END as has_image_signature,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_hash'
    ) THEN 'OUI' ELSE 'NON' END as has_image_hash,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_metadata'
    ) THEN 'OUI' ELSE 'NON' END as has_image_metadata;

-- Vérifier les données existantes
SELECT 
    COUNT(*) as total_media,
    COUNT(CASE WHEN type = 'image' THEN 1 END) as total_images,
    COUNT(CASE WHEN type = 'image' AND image_signature IS NOT NULL THEN 1 END) as images_with_signature,
    COUNT(CASE WHEN type = 'image' AND image_metadata IS NOT NULL THEN 1 END) as images_with_metadata
FROM media;

-- Vérifier les fonctions de recherche d'images
SELECT 
    proname as function_name,
    proargtypes::regtype[] as argument_types,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname IN ('search_images_by_metadata', 'calculate_image_similarity', 'search_similar_images')
ORDER BY proname;

-- Vérifier les index sur la table media
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'media';

-- Vérifier un exemple de données JSON dans services.data
SELECT 
    id,
    data->>'titre_service' as titre,
    data->>'gps_fixe' as gps_fixe,
    data->>'category' as category,
    jsonb_typeof(data->'gps_fixe') as gps_fixe_type,
    jsonb_typeof(data->'category') as category_type
FROM services 
LIMIT 5; 
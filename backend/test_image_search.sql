-- Script de test pour la recherche d'images
-- Base de données: yukpo_db

-- 1. Vérifier que les colonnes existent
SELECT 
    'Vérification des colonnes' as test_type,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_signature'
    ) THEN 'OK' ELSE 'MANQUANT' END as image_signature,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_hash'
    ) THEN 'OK' ELSE 'MANQUANT' END as image_hash,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_metadata'
    ) THEN 'OK' ELSE 'MANQUANT' END as image_metadata;

-- 2. Vérifier que les fonctions existent
SELECT 
    'Vérification des fonctions' as test_type,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'calculate_image_similarity'
    ) THEN 'OK' ELSE 'MANQUANT' END as calculate_image_similarity,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'search_similar_images'
    ) THEN 'OK' ELSE 'MANQUANT' END as search_similar_images,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'search_images_by_metadata'
    ) THEN 'OK' ELSE 'MANQUANT' END as search_images_by_metadata;

-- 3. Vérifier les données existantes
SELECT 
    'Données existantes' as test_type,
    COUNT(*) as total_media,
    COUNT(CASE WHEN type = 'image' THEN 1 END) as total_images,
    COUNT(CASE WHEN type = 'image' AND image_signature IS NOT NULL THEN 1 END) as images_with_signature,
    COUNT(CASE WHEN type = 'image' AND image_metadata IS NOT NULL THEN 1 END) as images_with_metadata
FROM media;

-- 4. Test de la fonction search_images_by_metadata avec des métadonnées fictives
SELECT 'Test de recherche par métadonnées' as test_type;

-- Créer des métadonnées de test
WITH test_metadata AS (
    SELECT '{"format": "jpeg", "width": 800, "height": 600, "file_size": 102400}'::TEXT as metadata
)
SELECT 
    m.media_id,
    m.service_id,
    m.path,
    m.similarity_score,
    m.image_metadata
FROM test_metadata tm
CROSS JOIN LATERAL search_images_by_metadata(tm.metadata, 5) m;

-- 5. Test de la fonction search_similar_images avec une signature fictive
SELECT 'Test de recherche par similarité' as test_type;

-- Créer une signature de test (192 valeurs float)
WITH test_signature AS (
    SELECT jsonb_build_array(
        jsonb_build_array(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0)
    ) as signature
)
SELECT 
    m.media_id,
    m.service_id,
    m.path,
    m.similarity_score,
    m.image_metadata
FROM test_signature ts
CROSS JOIN LATERAL search_similar_images(ts.signature, 0.1, 5) m;

-- 6. Afficher un exemple de données d'image
SELECT 
    'Exemple de données d\'image' as test_type,
    id,
    service_id,
    type,
    path,
    CASE WHEN image_signature IS NOT NULL THEN 'OUI' ELSE 'NON' END as has_signature,
    CASE WHEN image_metadata IS NOT NULL THEN 'OUI' ELSE 'NON' END as has_metadata
FROM media 
WHERE type = 'image' 
LIMIT 3; 
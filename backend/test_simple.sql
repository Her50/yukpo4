-- Test simple de la recherche d'images
-- Base de données: yukpo_db

-- 1. Vérifier les colonnes
SELECT 'Colonnes d\'image' as test_type,
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

-- 2. Vérifier les fonctions
SELECT 'Fonctions PostgreSQL' as test_type,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'search_images_by_metadata'
    ) THEN 'OK' ELSE 'MANQUANT' END as search_images_by_metadata;

-- 3. Test de la fonction avec des métadonnées fictives
SELECT 'Test de recherche' as test_type;

-- Test avec des métadonnées JPEG
SELECT * FROM search_images_by_metadata(
    '{"format": "jpeg", "width": 800, "height": 600, "file_size": 102400}',
    5
);

-- 4. Afficher la structure finale de la table media
SELECT 'Structure de la table media' as test_type;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'media' 
ORDER BY ordinal_position; 
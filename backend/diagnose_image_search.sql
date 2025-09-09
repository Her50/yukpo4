-- Diagnostic de la recherche d'images
-- Vérifier le contenu de la table media

-- 1. Vérifier les images dans la table media
SELECT 
    id, 
    service_id, 
    type, 
    path, 
    CASE WHEN image_signature IS NOT NULL THEN 'OUI' ELSE 'NON' END as has_signature,
    CASE WHEN image_metadata IS NOT NULL THEN 'OUI' ELSE 'NON' END as has_metadata,
    CASE WHEN image_hash IS NOT NULL THEN 'OUI' ELSE 'NON' END as has_hash
FROM media 
WHERE type = 'image' 
ORDER BY id DESC 
LIMIT 10;

-- 2. Vérifier la structure de la table media
\d media;

-- 3. Vérifier les fonctions PostgreSQL pour la recherche d'images
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname LIKE '%search%' OR proname LIKE '%image%';

-- 4. Vérifier les extensions installées
SELECT * FROM pg_extension;

-- 5. Tester la fonction de calcul de similarité
SELECT calculate_image_similarity(
    '[0.1, 0.2, 0.3]'::jsonb,
    '[0.1, 0.2, 0.3]'::jsonb
) as similarity_test; 
-- Vérification des fonctions PostgreSQL pour la recherche d'images

-- 1. Vérifier si la fonction search_similar_images existe
SELECT 
    proname as function_name,
    prosrc as function_source,
    proargtypes::regtype[] as argument_types
FROM pg_proc 
WHERE proname = 'search_similar_images';

-- 2. Vérifier si la fonction calculate_image_similarity existe
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname = 'calculate_image_similarity';

-- 3. Vérifier la structure de la table media
\d media;

-- 4. Vérifier les extensions installées
SELECT * FROM pg_extension;

-- 5. Vérifier les migrations appliquées
SELECT * FROM _sqlx_migrations ORDER BY version; 
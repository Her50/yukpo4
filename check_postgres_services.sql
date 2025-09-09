-- Vérification des services existants dans PostgreSQL
-- Exécutez ce script dans votre base de données PostgreSQL

-- 1. Compter le nombre total de services
SELECT 'Nombre total de services' as info, COUNT(*) as count FROM services;

-- 2. Compter les services actifs
SELECT 'Services actifs' as info, COUNT(*) as count FROM services WHERE is_active = true;

-- 3. Compter les services inactifs
SELECT 'Services inactifs' as info, COUNT(*) as count FROM services WHERE is_active = false;

-- 4. Afficher les 20 premiers services avec leurs détails
SELECT 
    id,
    user_id,
    category,
    is_active,
    created_at,
    SUBSTRING(data::text, 1, 100) as data_preview
FROM services 
ORDER BY id 
LIMIT 20;

-- 5. Vérifier les services par catégorie
SELECT 
    category,
    COUNT(*) as count,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
FROM services 
GROUP BY category 
ORDER BY count DESC;

-- 6. Vérifier les IDs spécifiques mentionnés dans les logs
SELECT 
    id,
    category,
    is_active,
    CASE 
        WHEN id IN (27437, 228231, 280093, 697714, 681447, 531974, 235094, 773325, 859203, 559614) 
        THEN 'TROUVÉ' 
        ELSE 'AUTRE' 
    END as status
FROM services 
WHERE id IN (27437, 228231, 280093, 697714, 681447, 531974, 235094, 773325, 859203, 559614)
ORDER BY id;

-- 7. Vérifier s'il y a des services avec des IDs élevés (comme ceux de Pinecone)
SELECT 
    'IDs élevés trouvés' as info,
    COUNT(*) as count
FROM services 
WHERE id > 10000;

-- 8. Afficher les 10 services avec les IDs les plus élevés
SELECT 
    id,
    category,
    is_active,
    created_at
FROM services 
ORDER BY id DESC 
LIMIT 10; 
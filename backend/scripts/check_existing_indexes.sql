-- Script pour vérifier les index existants sur la table services
-- À exécuter AVANT d'appliquer la migration 20251129_001_optimize_search_tsvector_performance.sql

-- 1. Lister tous les index sur la table services
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'services'
ORDER BY indexname;

-- 2. Vérifier spécifiquement les index tsvector existants
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'services'
AND (
    indexdef LIKE '%to_tsvector%'
    OR indexname LIKE '%tsvector%'
    OR indexname LIKE '%fts%'
)
ORDER BY indexname;

-- 3. Vérifier les index trigram (pg_trgm) existants
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'services'
AND (
    indexdef LIKE '%trgm%'
    OR indexname LIKE '%trgm%'
)
ORDER BY indexname;

-- 4. Vérifier les index GIN sur data/produits
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'services'
AND (
    indexdef LIKE '%GIN%'
    AND (
        indexdef LIKE '%data%'
        OR indexdef LIKE '%produits%'
        OR indexname LIKE '%produits%'
    )
)
ORDER BY indexname;

-- 5. Compter le nombre total d'index sur services
SELECT 
    COUNT(*) as total_indexes,
    COUNT(*) FILTER (WHERE indexdef LIKE '%GIN%') as gin_indexes,
    COUNT(*) FILTER (WHERE indexdef LIKE '%to_tsvector%') as tsvector_indexes,
    COUNT(*) FILTER (WHERE indexdef LIKE '%trgm%') as trigram_indexes
FROM pg_indexes
WHERE tablename = 'services';


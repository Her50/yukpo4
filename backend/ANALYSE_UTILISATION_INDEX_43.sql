-- Analyse de l'utilisation des 43 index restants sur la table services
-- Date: 2025-11-29
-- Objectif: Identifier les index non utilisés ou peu utilisés

-- ============================================================
-- ÉTAPE 1: Statistiques d'utilisation des index
-- ============================================================

-- Note: pg_stat_user_indexes nécessite que les requêtes aient été exécutées
-- Si idx_scan = 0, cela peut signifier:
-- 1. L'index n'a jamais été utilisé (non nécessaire)
-- 2. L'index vient d'être créé (pas encore utilisé)
-- 3. Les statistiques n'ont pas été mises à jour

SELECT 
    s.indexrelname as indexname,
    s.idx_scan as scans,
    s.idx_tup_read as tuples_read,
    s.idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(s.indexrelid)) as size,
    CASE 
        WHEN s.idx_scan = 0 THEN '❌ JAMAIS UTILISÉ'
        WHEN s.idx_scan < 10 THEN '⚠️ PEU UTILISÉ (<10 scans)'
        WHEN s.idx_scan < 100 THEN '✅ UTILISÉ (10-100 scans)'
        ELSE '✅✅ TRÈS UTILISÉ (>100 scans)'
    END as status
FROM pg_stat_user_indexes s
WHERE s.schemaname = 'public'
  AND s.relname = 'services'
ORDER BY s.idx_scan DESC, s.indexrelname;

-- ============================================================
-- ÉTAPE 2: Index avec unaccent_immutable() (ESSENTIELS)
-- ============================================================

SELECT 
    s.indexrelname as indexname,
    s.idx_scan as scans,
    CASE 
        WHEN s.idx_scan = 0 THEN '⚠️ Pas encore utilisé (peut être normal si récemment créé)'
        ELSE '✅ Utilisé'
    END as status
FROM pg_stat_user_indexes s
WHERE s.schemaname = 'public'
  AND s.relname = 'services'
  AND s.indexrelname LIKE '%unaccent%'
ORDER BY s.idx_scan DESC;

-- ============================================================
-- ÉTAPE 3: Index produits (ESSENTIELS)
-- ============================================================

SELECT 
    s.indexrelname as indexname,
    s.idx_scan as scans,
    CASE 
        WHEN s.idx_scan = 0 THEN '⚠️ Pas encore utilisé'
        ELSE '✅ Utilisé'
    END as status
FROM pg_stat_user_indexes s
WHERE s.schemaname = 'public'
  AND s.relname = 'services'
  AND (s.indexrelname LIKE '%produit%' OR s.indexrelname LIKE '%product%')
ORDER BY s.idx_scan DESC;

-- ============================================================
-- ÉTAPE 4: Index GPS (ESSENTIELS)
-- ============================================================

SELECT 
    s.indexrelname as indexname,
    s.idx_scan as scans,
    CASE 
        WHEN s.idx_scan = 0 THEN '⚠️ Pas encore utilisé'
        ELSE '✅ Utilisé'
    END as status
FROM pg_stat_user_indexes s
WHERE s.schemaname = 'public'
  AND s.relname = 'services'
  AND (s.indexrelname LIKE '%gps%' OR s.indexrelname LIKE '%location%' OR s.indexrelname LIKE '%geo%')
ORDER BY s.idx_scan DESC;

-- ============================================================
-- ÉTAPE 5: Index potentiellement non nécessaires
-- ============================================================

-- Index avec 0 scans (jamais utilisés)
SELECT 
    s.indexrelname as indexname,
    pg_size_pretty(pg_relation_size(s.indexrelid)) as size,
    i.indexdef,
    '❌ CANDIDAT POUR SUPPRESSION' as recommendation
FROM pg_stat_user_indexes s
JOIN pg_indexes i ON s.indexrelname = i.indexname
WHERE s.schemaname = 'public'
  AND s.relname = 'services'
  AND s.idx_scan = 0
  AND s.indexrelname != 'services_pkey'
  AND s.indexrelname NOT LIKE '%unaccent%'  -- Garder les nouveaux index
  AND s.indexrelname NOT LIKE '%produit%'
  AND s.indexrelname NOT LIKE '%product%'
  AND s.indexrelname NOT LIKE '%gps%'
  AND s.indexrelname NOT LIKE '%location%'
ORDER BY pg_relation_size(s.indexrelid) DESC;

-- ============================================================
-- ÉTAPE 6: Résumé par catégorie
-- ============================================================

SELECT 
    CASE 
        WHEN indexrelname LIKE '%unaccent%' THEN 'Index unaccent_immutable()'
        WHEN indexrelname LIKE '%produit%' OR indexrelname LIKE '%product%' THEN 'Index produits'
        WHEN indexrelname LIKE '%gps%' OR indexrelname LIKE '%location%' OR indexrelname LIKE '%geo%' THEN 'Index GPS'
        WHEN indexrelname LIKE '%user%' OR indexrelname LIKE '%created%' THEN 'Index user/created'
        WHEN indexrelname LIKE '%search%' OR indexrelname LIKE '%fulltext%' OR indexrelname LIKE '%tsvector%' THEN 'Index recherche'
        ELSE 'Autres index'
    END as category,
    COUNT(*) as total_indexes,
    COUNT(*) FILTER (WHERE idx_scan = 0) as non_utilises,
    COUNT(*) FILTER (WHERE idx_scan > 0) as utilises,
    SUM(idx_scan) as total_scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND relname = 'services'
GROUP BY category
ORDER BY total_indexes DESC;


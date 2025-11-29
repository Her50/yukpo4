-- Script de nettoyage des index sur la table services
-- Date: 2025-11-29
-- Objectif: Réduire de 92 index à 20-30 index essentiels
-- 
-- ⚠️ ATTENTION: Ce script identifie et propose la suppression d'index.
-- Exécuter d'abord en mode "DRY RUN" pour voir ce qui sera supprimé.
-- 
-- Pour exécuter en mode DRY RUN: Ne pas exécuter les DROP INDEX, seulement les SELECT
-- Pour exécuter réellement: Exécuter les DROP INDEX après vérification

-- ============================================================
-- ÉTAPE 1: Identifier les index non utilisés (via pg_stat_user_indexes)
-- ============================================================

-- Afficher les index jamais utilisés (idx_scan = 0)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
    'NON UTILISÉ' as status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename = 'services'
  AND idx_scan = 0
  AND indexname != 'services_pkey'  -- Ne pas supprimer la clé primaire
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- ============================================================
-- ÉTAPE 2: Identifier les doublons (index similaires)
-- ============================================================

-- Index pour titre_service (garder seulement les meilleurs)
SELECT 
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
    CASE 
        WHEN indexname LIKE '%unaccent%' THEN '✅ GARDER (nouveau avec unaccent_immutable)'
        WHEN indexname LIKE '%trgm%' AND indexname NOT LIKE '%unaccent%' THEN '❌ DOUBLON (remplacé par unaccent)'
        WHEN indexname LIKE '%fts%' AND indexname NOT LIKE '%unaccent%' THEN '❌ DOUBLON (remplacé par unaccent)'
        WHEN indexname LIKE '%tsvector%' AND indexname NOT LIKE '%unaccent%' THEN '❌ DOUBLON (remplacé par unaccent)'
        ELSE '⚠️ À ÉVALUER'
    END as recommendation
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'services'
  AND (indexname LIKE '%titre_service%' OR indexdef LIKE '%titre_service%')
ORDER BY 
    CASE WHEN indexname LIKE '%unaccent%' THEN 1 ELSE 2 END,
    indexname;

-- Index pour description (garder seulement les meilleurs)
SELECT 
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
    CASE 
        WHEN indexname LIKE '%unaccent%' THEN '✅ GARDER (nouveau avec unaccent_immutable)'
        WHEN indexname LIKE '%trgm%' AND indexname NOT LIKE '%unaccent%' THEN '❌ DOUBLON (remplacé par unaccent)'
        WHEN indexname LIKE '%fts%' AND indexname NOT LIKE '%unaccent%' THEN '❌ DOUBLON (remplacé par unaccent)'
        WHEN indexname LIKE '%tsvector%' AND indexname NOT LIKE '%unaccent%' THEN '❌ DOUBLON (remplacé par unaccent)'
        ELSE '⚠️ À ÉVALUER'
    END as recommendation
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'services'
  AND (indexname LIKE '%description%' OR indexdef LIKE '%description%')
ORDER BY 
    CASE WHEN indexname LIKE '%unaccent%' THEN 1 ELSE 2 END,
    indexname;

-- Index pour category (garder seulement les meilleurs)
SELECT 
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
    CASE 
        WHEN indexname LIKE '%unaccent%' THEN '✅ GARDER (nouveau avec unaccent_immutable)'
        WHEN indexname LIKE '%trgm%' AND indexname NOT LIKE '%unaccent%' THEN '❌ DOUBLON (remplacé par unaccent)'
        WHEN indexname LIKE '%tsvector%' AND indexname NOT LIKE '%unaccent%' THEN '❌ DOUBLON (remplacé par unaccent)'
        ELSE '⚠️ À ÉVALUER'
    END as recommendation
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'services'
  AND (indexname LIKE '%category%' OR indexdef LIKE '%category%')
ORDER BY 
    CASE WHEN indexname LIKE '%unaccent%' THEN 1 ELSE 2 END,
    indexname;

-- Index pour produits (garder seulement les meilleurs)
SELECT 
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
    CASE 
        WHEN indexname LIKE '%jsonb_path_ops%' THEN '✅ GARDER (le plus performant)'
        WHEN indexname LIKE '%gin_optimized%' THEN '✅ GARDER (optimisé)'
        WHEN indexname LIKE '%produits_gin%' AND indexname NOT LIKE '%optimized%' THEN '❌ DOUBLON (remplacé par gin_optimized)'
        WHEN indexname LIKE '%data_produits%' THEN '❌ DOUBLON (redondant)'
        ELSE '⚠️ À ÉVALUER'
    END as recommendation
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'services'
  AND (indexname LIKE '%produit%' OR indexname LIKE '%product%' OR indexdef LIKE '%produit%' OR indexdef LIKE '%product%')
ORDER BY 
    CASE WHEN indexname LIKE '%jsonb_path_ops%' THEN 1 
         WHEN indexname LIKE '%optimized%' THEN 2 
         ELSE 3 END,
    indexname;

-- Index pour GPS (garder seulement les meilleurs)
SELECT 
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
    CASE 
        WHEN indexname LIKE '%gist%' THEN '✅ GARDER (PostGIS - le plus performant)'
        WHEN indexname LIKE '%gps_search%' THEN '✅ GARDER (recherche simple)'
        WHEN indexname LIKE '%trgm%' OR indexname LIKE '%trigram%' THEN '❌ DOUBLON (peu utile pour GPS)'
        WHEN indexname LIKE '%btree%' AND indexname NOT LIKE '%search%' THEN '❌ DOUBLON (remplacé par gist)'
        ELSE '⚠️ À ÉVALUER'
    END as recommendation
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'services'
  AND (indexname LIKE '%gps%' OR indexname LIKE '%location%' OR indexname LIKE '%geo%' OR indexdef LIKE '%gps%')
ORDER BY 
    CASE WHEN indexname LIKE '%gist%' THEN 1 
         WHEN indexname LIKE '%search%' THEN 2 
         ELSE 3 END,
    indexname;

-- Index pour user_id/created_at (garder seulement les meilleurs)
SELECT 
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
    CASE 
        WHEN indexname LIKE '%optimized%' THEN '✅ GARDER (le plus complet)'
        WHEN indexname LIKE '%user_id_created_at_desc%' AND indexname NOT LIKE '%optimized%' THEN '❌ DOUBLON (remplacé par optimized)'
        WHEN indexname LIKE '%user_active%' AND indexname NOT LIKE '%optimized%' THEN '❌ DOUBLON (redondant)'
        ELSE '⚠️ À ÉVALUER'
    END as recommendation
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'services'
  AND (indexname LIKE '%user%' OR indexname LIKE '%created%' OR indexdef LIKE '%user_id%' OR indexdef LIKE '%created_at%')
ORDER BY 
    CASE WHEN indexname LIKE '%optimized%' THEN 1 ELSE 2 END,
    indexname;

-- ============================================================
-- ÉTAPE 3: Liste des index à SUPPRIMER (doublons et non utilisés)
-- ============================================================

-- ⚠️ MODE DRY RUN: Afficher seulement ce qui sera supprimé
-- Pour exécuter réellement, décommenter les DROP INDEX ci-dessous

-- Index titre_service (supprimer les anciens, garder unaccent)
-- DROP INDEX IF EXISTS idx_services_titre_service_trgm;
-- DROP INDEX IF EXISTS idx_services_titre_service_trgm_keyword;
-- DROP INDEX IF EXISTS idx_services_titre_service_fts;
-- DROP INDEX IF EXISTS idx_services_titre_service_tsvector;
-- DROP INDEX IF EXISTS idx_services_fulltext_titre;
-- DROP INDEX IF EXISTS idx_services_trgm_titre;
-- DROP INDEX IF EXISTS idx_services_trigram_titre;
-- DROP INDEX IF EXISTS idx_services_structured_titre;
-- DROP INDEX IF EXISTS idx_services_structured_trigram_titre;
-- DROP INDEX IF EXISTS idx_services_data_titre_service_gin;

-- Index description (supprimer les anciens, garder unaccent)
-- DROP INDEX IF EXISTS idx_services_description_trgm;
-- DROP INDEX IF EXISTS idx_services_description_trgm_keyword;
-- DROP INDEX IF EXISTS idx_services_description_fts;
-- DROP INDEX IF EXISTS idx_services_description_tsvector;
-- DROP INDEX IF EXISTS idx_services_fulltext_description;
-- DROP INDEX IF EXISTS idx_services_trgm_description;
-- DROP INDEX IF EXISTS idx_services_trigram_description;
-- DROP INDEX IF EXISTS idx_services_structured_description;
-- DROP INDEX IF EXISTS idx_services_structured_trigram_description;
-- DROP INDEX IF EXISTS idx_services_data_description_gin;

-- Index category (supprimer les anciens, garder unaccent)
-- DROP INDEX IF EXISTS idx_services_category_trgm;
-- DROP INDEX IF EXISTS idx_services_category_trgm_keyword;
-- DROP INDEX IF EXISTS idx_services_category_tsvector;
-- DROP INDEX IF EXISTS idx_services_fulltext_category;
-- DROP INDEX IF EXISTS idx_services_trgm_category;
-- DROP INDEX IF EXISTS idx_services_trigram_category;
-- DROP INDEX IF EXISTS idx_services_structured_category;
-- DROP INDEX IF EXISTS idx_services_structured_trigram_category;

-- Index produits (supprimer les doublons, garder jsonb_path_ops et gin_optimized)
-- DROP INDEX IF EXISTS idx_services_produits_gin;  -- Doublon de gin_optimized
-- DROP INDEX IF EXISTS idx_services_data_produits_gin;
-- DROP INDEX IF EXISTS idx_services_data_produits_extraction_gin;

-- Index GPS (supprimer les doublons, garder gist et search)
-- DROP INDEX IF EXISTS idx_services_gps_trgm;
-- DROP INDEX IF EXISTS idx_services_gps_trigram;
-- DROP INDEX IF EXISTS idx_services_gps_fixe_trgm;
-- DROP INDEX IF EXISTS idx_services_gps_btree;  -- Si gist existe

-- Index user_id/created_at (supprimer les doublons, garder optimized)
-- DROP INDEX IF EXISTS idx_services_user_id_created_at;
-- DROP INDEX IF EXISTS idx_services_user_id_created_at_desc;
-- DROP INDEX IF EXISTS idx_services_user_id_created_at_desc_count;
-- DROP INDEX IF EXISTS idx_services_user_id_is_active_created_at;
-- DROP INDEX IF EXISTS idx_services_user_active;
-- DROP INDEX IF EXISTS idx_services_user_active_created;
-- DROP INDEX IF EXISTS idx_services_user_status;

-- Index full-text combinés (supprimer les doublons, garder search_combined_tsvector)
-- DROP INDEX IF EXISTS idx_services_fulltext_combined;
-- DROP INDEX IF EXISTS idx_services_fulltext_optimized;
-- DROP INDEX IF EXISTS idx_services_trigram_combined;

-- Index autres (supprimer si non utilisés)
-- DROP INDEX IF EXISTS idx_services_category_direct;
-- DROP INDEX IF EXISTS idx_services_gps;  -- Doublon
-- DROP INDEX IF EXISTS idx_services_intention;
-- DROP INDEX IF EXISTS idx_services_tags_jsonb;  -- Si non utilisé

-- ============================================================
-- ÉTAPE 4: Liste des index à GARDER (essentiels)
-- ============================================================

-- Index avec unaccent_immutable() (NOUVEAUX - ESSENTIELS)
-- ✅ idx_services_titre_service_unaccent_trgm
-- ✅ idx_services_titre_service_unaccent_fts
-- ✅ idx_services_description_unaccent_trgm
-- ✅ idx_services_description_unaccent_fts
-- ✅ idx_services_category_unaccent_trgm

-- Index produits (ESSENTIELS)
-- ✅ idx_services_produits_jsonb_path_ops
-- ✅ idx_services_produits_gin_optimized
-- ✅ idx_services_produits_characteristic_vector_gin (si utilisé)

-- Index GPS (ESSENTIELS)
-- ✅ idx_services_gps_gist (PostGIS)
-- ✅ idx_services_gps_search
-- ✅ idx_services_location_geog
-- ✅ idx_services_location_geom

-- Index user/created (ESSENTIELS)
-- ✅ idx_services_user_id_created_at_desc_optimized
-- ✅ idx_services_user_id_count (si utilisé)

-- Index autres (ESSENTIELS)
-- ✅ services_pkey (clé primaire)
-- ✅ idx_services_is_active_created_at
-- ✅ idx_services_search_combined_tsvector
-- ✅ idx_services_active_created
-- ✅ idx_services_category_active
-- ✅ idx_services_category_search
-- ✅ idx_services_titre_service_search
-- ✅ idx_services_products_tsvector (si utilisé)
-- ✅ idx_services_products_fulltext_all (si utilisé)

-- ============================================================
-- ÉTAPE 5: Vérification finale (après nettoyage)
-- ============================================================

-- Compter les index restants
SELECT 
    COUNT(*) as total_indexes,
    pg_size_pretty(SUM(pg_relation_size(indexname::regclass))) as total_size
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'services';

-- Lister tous les index restants
SELECT 
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'services'
ORDER BY indexname;


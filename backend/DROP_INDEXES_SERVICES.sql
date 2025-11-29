-- Script de suppression des index redondants sur la table services
-- Date: 2025-11-29
-- Objectif: Réduire de 92 index à ~25 index essentiels
-- 
-- ⚠️ ATTENTION: Ce script SUPPRIME réellement les index.
-- Exécuter d'abord CLEANUP_INDEXES_SERVICES.sql en mode DRY RUN pour vérifier.
-- 
-- Pour exécuter: psql -h ... -U ... -d ... -f DROP_INDEXES_SERVICES.sql

-- ============================================================
-- ÉTAPE 1: Supprimer les index titre_service redondants
-- (Garder seulement les index avec unaccent_immutable)
-- ============================================================

DROP INDEX IF EXISTS idx_services_titre_service_trgm;
DROP INDEX IF EXISTS idx_services_titre_service_trgm_keyword;
DROP INDEX IF EXISTS idx_services_titre_service_fts;
DROP INDEX IF EXISTS idx_services_titre_service_tsvector;
DROP INDEX IF EXISTS idx_services_fulltext_titre;
DROP INDEX IF EXISTS idx_services_trgm_titre;
DROP INDEX IF EXISTS idx_services_trigram_titre;
DROP INDEX IF EXISTS idx_services_structured_titre;
DROP INDEX IF EXISTS idx_services_structured_trigram_titre;
DROP INDEX IF EXISTS idx_services_data_titre_service_gin;

-- ============================================================
-- ÉTAPE 2: Supprimer les index description redondants
-- (Garder seulement les index avec unaccent_immutable)
-- ============================================================

DROP INDEX IF EXISTS idx_services_description_trgm;
DROP INDEX IF EXISTS idx_services_description_trgm_keyword;
DROP INDEX IF EXISTS idx_services_description_fts;
DROP INDEX IF EXISTS idx_services_description_tsvector;
DROP INDEX IF EXISTS idx_services_fulltext_description;
DROP INDEX IF EXISTS idx_services_trgm_description;
DROP INDEX IF EXISTS idx_services_trigram_description;
DROP INDEX IF EXISTS idx_services_structured_description;
DROP INDEX IF EXISTS idx_services_structured_trigram_description;
DROP INDEX IF EXISTS idx_services_data_description_gin;

-- ============================================================
-- ÉTAPE 3: Supprimer les index category redondants
-- (Garder seulement les index avec unaccent_immutable)
-- ============================================================

DROP INDEX IF EXISTS idx_services_category_trgm;
DROP INDEX IF EXISTS idx_services_category_trgm_keyword;
DROP INDEX IF EXISTS idx_services_category_tsvector;
DROP INDEX IF EXISTS idx_services_fulltext_category;
DROP INDEX IF EXISTS idx_services_trgm_category;
DROP INDEX IF EXISTS idx_services_trigram_category;
DROP INDEX IF EXISTS idx_services_structured_category;
DROP INDEX IF EXISTS idx_services_structured_trigram_category;
DROP INDEX IF EXISTS idx_services_category_direct;

-- ============================================================
-- ÉTAPE 4: Supprimer les index produits redondants
-- (Garder seulement jsonb_path_ops et gin_optimized)
-- ============================================================

DROP INDEX IF EXISTS idx_services_produits_gin;  -- Doublon de gin_optimized
DROP INDEX IF EXISTS idx_services_data_produits_gin;
DROP INDEX IF EXISTS idx_services_data_produits_extraction_gin;

-- ============================================================
-- ÉTAPE 5: Supprimer les index GPS redondants
-- (Garder seulement gist et search)
-- ============================================================

DROP INDEX IF EXISTS idx_services_gps_trgm;
DROP INDEX IF EXISTS idx_services_gps_trigram;
DROP INDEX IF EXISTS idx_services_gps_fixe_trgm;
DROP INDEX IF EXISTS idx_services_gps_btree;  -- Si gist existe
DROP INDEX IF EXISTS idx_services_gps;  -- Doublon

-- ============================================================
-- ÉTAPE 6: Supprimer les index user_id/created_at redondants
-- (Garder seulement optimized)
-- ============================================================

DROP INDEX IF EXISTS idx_services_user_id_created_at;
DROP INDEX IF EXISTS idx_services_user_id_created_at_desc;
DROP INDEX IF EXISTS idx_services_user_id_created_at_desc_count;
DROP INDEX IF EXISTS idx_services_user_id_is_active_created_at;
DROP INDEX IF EXISTS idx_services_user_active;
DROP INDEX IF EXISTS idx_services_user_active_created;
DROP INDEX IF EXISTS idx_services_user_status;

-- ============================================================
-- ÉTAPE 7: Supprimer les index full-text combinés redondants
-- (Garder seulement search_combined_tsvector)
-- ============================================================

DROP INDEX IF EXISTS idx_services_fulltext_combined;
DROP INDEX IF EXISTS idx_services_fulltext_optimized;
DROP INDEX IF EXISTS idx_services_trigram_combined;

-- ============================================================
-- ÉTAPE 8: Supprimer les index autres (si non utilisés)
-- ============================================================

DROP INDEX IF EXISTS idx_services_intention;
DROP INDEX IF EXISTS idx_services_tags_jsonb;  -- Si non utilisé

-- ============================================================
-- ÉTAPE 9: Vérification finale
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
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'services'
ORDER BY indexname;


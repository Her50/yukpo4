-- Migration: Optimisation de la recherche de produits dans search_services_fallback
-- Date: 2025-11-28
-- Description: Optimise la fonction search_services_fallback dans rechercher_besoin.rs
--              qui utilisait une boucle avec EXISTS(jsonb_array_elements) très lente
--              Remplace par une requête unique avec CTE pour extraire les produits une seule fois
-- Compatible: SQLx offline mode

-- ============================================
-- 1. VÉRIFICATION DES INDEX EXISTANTS
-- ============================================

-- Vérifier que l'index GIN sur produits existe (créé dans 20251020006_improve_product_search_all_fields.sql)
-- Si l'index n'existe pas, le créer
CREATE INDEX IF NOT EXISTS idx_services_products_fulltext_all 
ON services USING GIN (
    to_tsvector('french', extract_service_products_text(data))
)
WHERE is_active = true;

-- Index GIN sur data->'produits' pour recherche JSONB rapide
CREATE INDEX IF NOT EXISTS idx_services_produits_gin_optimized 
ON services USING GIN ((data->'produits'))
WHERE is_active = true 
  AND (jsonb_typeof(data->'produits') = 'array' 
       OR jsonb_typeof(data->'produits'->'valeur') = 'array');

-- ============================================
-- 2. ANALYSE DES TABLES (mise à jour statistiques)
-- ============================================

-- Analyser la table services pour mettre à jour les statistiques du planificateur
-- Cela permet à PostgreSQL d'utiliser efficacement les index créés
ANALYZE services;

-- ============================================
-- 3. COMMENTAIRES POUR DOCUMENTATION
-- ============================================

COMMENT ON INDEX idx_services_products_fulltext_all IS 
'Index GIN full-text sur tous les textes extraits des produits. Utilisé par la recherche optimisée avec CTE dans search_services_fallback.';

COMMENT ON INDEX idx_services_produits_gin_optimized IS 
'Index GIN pour recherche rapide dans les produits JSONB. Utilisé par les CTE pour éviter les multiples passes sur jsonb_array_elements.';

-- ============================================
-- 4. NOTES D'OPTIMISATION
-- ============================================

-- AVANT (lent):
-- - Boucle for term in search_terms
-- - Requête SQL avec EXISTS(jsonb_array_elements(...)) pour chaque terme
-- - N passes sur les produits (N = nombre de termes)
-- - Temps: ~2000ms+ pour plusieurs termes
--
-- APRÈS (optimisé):
-- - Une seule requête SQL avec CTE
-- - Extraction des produits une seule fois dans products_extracted
-- - Vérification des correspondances en une seule passe avec CROSS JOIN search_patterns
-- - Temps estimé: <500ms pour plusieurs termes
--
-- La requête optimisée utilise:
-- 1. CTE products_extracted: extrait les produits UNE SEULE FOIS
-- 2. CTE search_patterns: convertit le tableau de patterns en lignes
-- 3. CTE products_matched: vérifie les correspondances avec CROSS JOIN
-- 4. SELECT final: retourne les résultats distincts


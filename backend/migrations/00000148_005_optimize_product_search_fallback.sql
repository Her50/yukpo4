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
-- Si l'index n'existe pas, le créer (protégé avec création de la fonction si nécessaire)

-- Créer la fonction extract_service_products_text si elle n'existe pas
CREATE OR REPLACE FUNCTION extract_service_products_text(service_data JSONB)
RETURNS TEXT AS $func$
DECLARE
    aggregated TEXT := '';
    products JSONB;
    product_record JSONB;
BEGIN
    products := CASE 
        WHEN jsonb_typeof(service_data->'produits') = 'array' 
        THEN service_data->'produits'
        ELSE '[]'::jsonb
    END;

    FOR product_record IN SELECT * FROM jsonb_array_elements(products)
    LOOP
        aggregated := aggregated || ' ' || COALESCE(product_record->>'nom', '') || ' ' || COALESCE(product_record->>'description', '');
    END LOOP;

    RETURN trim(aggregated);
END;
$func$ LANGUAGE plpgsql IMMUTABLE;

-- Créer l'index si la table services existe (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') THEN
        CREATE INDEX IF NOT EXISTS idx_services_products_fulltext_all 
        ON services USING GIN (
            to_tsvector('french', extract_service_products_text(data))
        )
        WHERE is_active = true;
    END IF;
END $$;

-- Index GIN sur data->'produits' pour recherche JSONB rapide (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') THEN
        CREATE INDEX IF NOT EXISTS idx_services_produits_gin_optimized 
        ON services USING GIN ((data->'produits'))
        WHERE is_active = true 
          AND (jsonb_typeof(data->'produits') = 'array' 
               OR jsonb_typeof(data->'produits'->'valeur') = 'array');
    END IF;
END $$;

-- ============================================
-- 2. ANALYSE DES TABLES (mise à jour statistiques)
-- ============================================

-- Analyser la table services pour mettre à jour les statistiques du planificateur (protégé)
-- Cela permet à PostgreSQL d'utiliser efficacement les index créés
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') THEN
        ANALYZE services;
    END IF;
END $$;

-- ============================================
-- 3. COMMENTAIRES POUR DOCUMENTATION
-- ============================================

-- Commentaires sur les index (protégés)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_products_fulltext_all') THEN
        COMMENT ON INDEX idx_services_products_fulltext_all IS 
        'Index GIN full-text sur tous les textes extraits des produits. Utilisé par la recherche optimisée avec CTE dans search_services_fallback.';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_produits_gin_optimized') THEN
        COMMENT ON INDEX idx_services_produits_gin_optimized IS 
        'Index GIN pour recherche rapide dans les produits JSONB. Utilisé par les CTE pour éviter les multiples passes sur jsonb_array_elements.';
    END IF;
END $$;

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


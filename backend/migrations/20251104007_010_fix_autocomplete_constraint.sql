-- Migration: Corriger les contraintes d'unicité de autocomplete_combinations
-- Date: 2025-11-04
-- Problème: Le code Rust utilise ON CONFLICT (product_vector) mais la contrainte est sur full_vector
-- Solution: Ajouter une contrainte sur product_vector ET garder celle sur full_vector

-- 1. Supprimer l'ancienne contrainte unique_full_vector (trop restrictive)
ALTER TABLE autocomplete_combinations 
DROP CONSTRAINT IF EXISTS unique_full_vector;

-- 2. Créer un index unique sur product_vector (ce que le code Rust attend)
-- Permet les doublons avec locations différentes mais incrémente usage_count pour même produit
CREATE UNIQUE INDEX IF NOT EXISTS idx_combinations_product_vector_unique 
    ON autocomplete_combinations(product_vector);

-- 3. Créer un index sur full_vector (pour recherche complète)
-- Non-unique car plusieurs produits peuvent avoir le même full_vector avec variations
CREATE INDEX IF NOT EXISTS idx_combinations_full_vector_gin_v2
    ON autocomplete_combinations USING GIN(full_vector);

-- Commentaire
COMMENT ON INDEX idx_combinations_product_vector_unique IS 
'Index unique sur product_vector pour ON CONFLICT dans le code Rust - Permet incrémentation usage_count';

SELECT '✅ Migration 20251104_010 appliquée - Contrainte product_vector corrigée' as status;


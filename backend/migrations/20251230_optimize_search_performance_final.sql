-- Migration: Optimisation Finale Performance Recherche
-- Date: 2025-12-30
-- Description: Réduire temps de recherche à < 2 secondes

-- =====================================================
-- 1. Fonction Optimisée : Calcul Meilleur Score Vectoriel
-- =====================================================

-- ✅ NOUVEAU: Fonction qui calcule les deux scores en une seule passe (évite double appel)
CREATE OR REPLACE FUNCTION calculate_best_vector_match_score(
    characteristic_vector_normalized TEXT[],
    full_vector_normalized TEXT[],
    search_keywords_normalized TEXT[]
)
RETURNS REAL AS $$
    SELECT GREATEST(
        COALESCE(calculate_vector_match_score_optimized(characteristic_vector_normalized, search_keywords_normalized), 0.0),
        COALESCE(calculate_vector_match_score_optimized(full_vector_normalized, search_keywords_normalized), 0.0)
    );
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION calculate_best_vector_match_score IS 'Calcule le meilleur score vectoriel entre characteristic et full_vector en une seule passe';

-- =====================================================
-- 2. Index Composite pour Filtres Fréquents (si pas déjà créé)
-- =====================================================

-- Index composite pour accélérer les filtres fréquents
CREATE INDEX IF NOT EXISTS idx_autocomplete_search_filters_composite 
ON autocomplete_characteristics (is_real_product, identifiant_base, service_id) 
WHERE is_real_product = TRUE AND identifiant_base = 'produits';

-- Index sur service_id pour accélérer les jointures
CREATE INDEX IF NOT EXISTS idx_autocomplete_service_id_active 
ON autocomplete_characteristics (service_id) 
WHERE is_real_product = TRUE AND identifiant_base = 'produits';

-- =====================================================
-- 3. Vérification
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'calculate_best_vector_match_score'
    ) THEN
        RAISE EXCEPTION 'Fonction calculate_best_vector_match_score non créée';
    END IF;
    
    RAISE NOTICE '✅ Migration optimisation performance recherche appliquée avec succès';
END $$;


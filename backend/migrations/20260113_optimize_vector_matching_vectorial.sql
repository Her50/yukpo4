-- Migration: Optimisation Matching Vectoriel avec Test Vectoriel (équivalent %in% R)
-- Date: 2026-01-13
-- Description: Remplace l'itération séquentielle par un test vectoriel unique (comme %in% en R)

-- =====================================================
-- Fonction de Matching Vectoriel Optimisée (Vectorielle)
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_vector_match_score_optimized(
    product_vector_normalized TEXT[],
    search_keywords_normalized TEXT[]
)
RETURNS REAL AS $$
    -- ✅ TEST VECTORIEL UNIQUE (équivalent à %in% en R) : Pas d'itération séquentielle
    -- Utilise l'intersection d'arrays pour compter les matches en une seule opération
    SELECT COALESCE(
        GREATEST(
            -- Score exact (100%) : Test vectoriel avec intersection
            -- Équivalent R: sum(search_keywords %in% product_vector) / length(search_keywords) * 100
            (
                SELECT array_length(
                    ARRAY(
                        SELECT unnest(search_keywords_normalized)
                        INTERSECT
                        SELECT unnest(product_vector_normalized)
                    ),
                    1
                )::REAL
            ) / NULLIF(array_length(search_keywords_normalized, 1), 0)::REAL * 100.0,
            
            -- Score partiel (70%) : Mots tronqués (LIKE) - toujours nécessaire pour variations
            -- Mais optimisé avec EXISTS au lieu de boucle
            (
                SELECT COUNT(*)::REAL
                FROM unnest(search_keywords_normalized) AS keyword
                WHERE EXISTS (
                    SELECT 1
                    FROM unnest(product_vector_normalized) AS elem
                    WHERE elem LIKE keyword || '%' OR keyword LIKE elem || '%'
                )
            ) / NULLIF(array_length(search_keywords_normalized, 1), 0)::REAL * 70.0,
            
            -- Score fuzzy (40%) : Fautes de frappe (similarity) - toujours nécessaire
            (
                SELECT COUNT(*)::REAL
                FROM unnest(search_keywords_normalized) AS keyword
                WHERE EXISTS (
                    SELECT 1
                    FROM unnest(product_vector_normalized) AS elem
                    WHERE similarity(keyword, elem) > 0.3
                )
            ) / NULLIF(array_length(search_keywords_normalized, 1), 0)::REAL * 40.0
        ),
        0.0
    );
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION calculate_vector_match_score_optimized IS 
'Calcule le score de matching vectoriel avec test vectoriel unique (équivalent %in% en R). 
Utilise l''intersection d''arrays pour compter les matches en une seule opération vectorielle.';

-- =====================================================
-- Vérification
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'calculate_vector_match_score_optimized'
    ) THEN
        RAISE EXCEPTION 'Fonction calculate_vector_match_score_optimized non créée';
    END IF;
    
    RAISE NOTICE '✅ Migration optimisation matching vectoriel vectoriel appliquée avec succès';
END $$;



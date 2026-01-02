-- Migration: Optimisation Matching Vectoriel avec Similarité en Une Passe
-- Date: 2025-12-30
-- Description: Implémente le matching vectoriel optimisé avec gestion des variantes (accents, mots tronqués, fautes de frappe) en une seule passe

-- =====================================================
-- 1. Fonction de Normalisation (IMMUTABLE)
-- =====================================================

-- Fonction pour normaliser un mot (supprimer accents, minuscules)
CREATE OR REPLACE FUNCTION normalize_word(word TEXT)
RETURNS TEXT AS $$
BEGIN
    IF word IS NULL OR word = '' THEN
        RETURN '';
    END IF;
    RETURN LOWER(
        translate(
            word,
            'àâäéèêëîïôöùûüÿç',
            'aaaeeeeiiioouuuyc'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour normaliser un array de mots
CREATE OR REPLACE FUNCTION normalize_word_array(word_array TEXT[])
RETURNS TEXT[] AS $$
BEGIN
    IF word_array IS NULL OR array_length(word_array, 1) IS NULL THEN
        RETURN ARRAY[]::TEXT[];
    END IF;
    RETURN ARRAY(
        SELECT normalize_word(unnest(word_array))
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 2. Colonnes Calculées Normalisées (Stockées)
-- =====================================================

-- Ajouter colonnes normalisées (calculées une seule fois, stockées)
ALTER TABLE autocomplete_characteristics 
ADD COLUMN IF NOT EXISTS normalized_characteristic_vector TEXT[] 
GENERATED ALWAYS AS (normalize_word_array(characteristic_vector)) STORED;

ALTER TABLE autocomplete_characteristics 
ADD COLUMN IF NOT EXISTS normalized_full_vector TEXT[] 
GENERATED ALWAYS AS (normalize_word_array(full_vector)) STORED;

-- =====================================================
-- 3. Index GIN sur Colonnes Normalisées
-- =====================================================

-- Index GIN pour accélérer l'opérateur && (overlap)
CREATE INDEX IF NOT EXISTS idx_autocomplete_normalized_characteristic_vector_gin 
ON autocomplete_characteristics USING GIN (normalized_characteristic_vector);

CREATE INDEX IF NOT EXISTS idx_autocomplete_normalized_full_vector_gin 
ON autocomplete_characteristics USING GIN (normalized_full_vector);

-- Index composite pour filtres fréquents
CREATE INDEX IF NOT EXISTS idx_autocomplete_normalized_filters 
ON autocomplete_characteristics (is_real_product, identifiant_base) 
WHERE is_real_product = TRUE AND identifiant_base = 'produits';

-- =====================================================
-- 4. Fonction de Matching Vectoriel Optimisée (Une Passe)
-- =====================================================

-- ✅ FONCTION SQL PURE (plus rapide que PL/pgSQL) : Matching avec similarité en UNE SEULE PASSE
CREATE OR REPLACE FUNCTION calculate_vector_match_score_optimized(
    product_vector_normalized TEXT[],
    search_keywords_normalized TEXT[]
)
RETURNS REAL AS $$
    -- ✅ UNE SEULE REQUÊTE : Combiner exact + partiel + fuzzy
    SELECT COALESCE(
        GREATEST(
            -- Score exact (100%) : Match exact normalisé
            (
                SELECT COUNT(*)::REAL
                FROM unnest(search_keywords_normalized) AS keyword
                WHERE keyword = ANY(product_vector_normalized)
            ) / NULLIF(array_length(search_keywords_normalized, 1), 0)::REAL * 100.0,
            -- Score partiel (70%) : Mots tronqués (LIKE)
            (
                SELECT COUNT(*)::REAL
                FROM unnest(search_keywords_normalized) AS keyword
                WHERE EXISTS (
                    SELECT 1
                    FROM unnest(product_vector_normalized) AS elem
                    WHERE elem LIKE keyword || '%' OR keyword LIKE elem || '%'
                )
            ) / NULLIF(array_length(search_keywords_normalized, 1), 0)::REAL * 70.0,
            -- Score fuzzy (40%) : Fautes de frappe (similarity)
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

-- =====================================================
-- 5. Mise à Jour des Vecteurs Existants
-- =====================================================

-- Les colonnes calculées seront automatiquement remplies pour les nouvelles insertions
-- Pour les données existantes, déclencher une mise à jour (les colonnes calculées se remplissent automatiquement)
-- Pas besoin de UPDATE car les colonnes sont GENERATED ALWAYS AS ... STORED

-- =====================================================
-- 6. Vérification
-- =====================================================

-- Vérifier que les fonctions existent
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'normalize_word'
    ) THEN
        RAISE EXCEPTION 'Fonction normalize_word non créée';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'normalize_word_array'
    ) THEN
        RAISE EXCEPTION 'Fonction normalize_word_array non créée';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'calculate_vector_match_score_optimized'
    ) THEN
        RAISE EXCEPTION 'Fonction calculate_vector_match_score_optimized non créée';
    END IF;
    
    RAISE NOTICE '✅ Toutes les fonctions ont été créées avec succès';
END $$;

-- Vérifier que les colonnes existent
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'autocomplete_characteristics' 
        AND column_name = 'normalized_characteristic_vector'
    ) THEN
        RAISE EXCEPTION 'Colonne normalized_characteristic_vector non créée';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'autocomplete_characteristics' 
        AND column_name = 'normalized_full_vector'
    ) THEN
        RAISE EXCEPTION 'Colonne normalized_full_vector non créée';
    END IF;
    
    RAISE NOTICE '✅ Toutes les colonnes ont été créées avec succès';
END $$;

-- Vérifier que les index existent
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_autocomplete_normalized_characteristic_vector_gin'
    ) THEN
        RAISE EXCEPTION 'Index idx_autocomplete_normalized_characteristic_vector_gin non créé';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_autocomplete_normalized_full_vector_gin'
    ) THEN
        RAISE EXCEPTION 'Index idx_autocomplete_normalized_full_vector_gin non créé';
    END IF;
    
    RAISE NOTICE '✅ Tous les index ont été créés avec succès';
END $$;

-- =====================================================
-- 7. Analyser les Tables pour Optimiser les Statistiques
-- =====================================================

ANALYZE autocomplete_characteristics;

-- =====================================================
-- 8. Test de Performance (Optionnel)
-- =====================================================

-- Test rapide de la fonction
DO $$
DECLARE
    test_vector TEXT[] := ARRAY['veste', 'cuir', 'zara'];
    test_keywords TEXT[] := ARRAY['veste', 'cuir', 'zara'];
    test_score REAL;
BEGIN
    test_score := calculate_vector_match_score_optimized(test_vector, test_keywords);
    IF test_score = 100.0 THEN
        RAISE NOTICE '✅ Test de matching exact réussi: score = %', test_score;
    ELSE
        RAISE WARNING '⚠️ Test de matching exact échoué: score = % (attendu 100.0)', test_score;
    END IF;
END $$;



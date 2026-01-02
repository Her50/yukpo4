-- ✅ Migration 2025-12-27: S'assurer que tous les index tsvector nécessaires existent
-- Cette migration vérifie et crée les index manquants pour la recherche simplifiée
-- Les index sont nécessaires pour la requête optimisée dans native_search_service.rs

-- =====================================================
-- 1. Index sur autocomplete_characteristics.valeur (tsvector GIN)
-- =====================================================
-- Utilisé dans la requête simplifiée pour recherche dans produits
CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristics_valeur_tsvector 
ON autocomplete_characteristics 
USING GIN (to_tsvector('french', valeur))
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- =====================================================
-- 2. Index sur services.data->'titre_service'->>'valeur' (tsvector GIN)
-- =====================================================
-- Utilisé dans la requête simplifiée pour recherche dans titre
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'services' 
        AND indexname = 'idx_services_titre_service_tsvector'
    ) THEN
        CREATE INDEX idx_services_titre_service_tsvector 
        ON services USING GIN (
            to_tsvector('french', 
                COALESCE(data->'titre_service'->>'valeur', '')
            )
        ) WHERE is_active = true;
        RAISE NOTICE '✅ Index idx_services_titre_service_tsvector créé';
    ELSE
        RAISE NOTICE 'ℹ️ Index idx_services_titre_service_tsvector existe déjà';
    END IF;
END $$;

-- =====================================================
-- 3. Index sur services.data->'description'->>'valeur' (tsvector GIN)
-- =====================================================
-- Utilisé dans la requête simplifiée pour recherche dans description
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'services' 
        AND indexname = 'idx_services_description_tsvector'
    ) THEN
        CREATE INDEX idx_services_description_tsvector 
        ON services USING GIN (
            to_tsvector('french', 
                COALESCE(data->'description'->>'valeur', '')
            )
        ) WHERE is_active = true;
        RAISE NOTICE '✅ Index idx_services_description_tsvector créé';
    ELSE
        RAISE NOTICE 'ℹ️ Index idx_services_description_tsvector existe déjà';
    END IF;
END $$;

-- =====================================================
-- 4. Index sur autocomplete_characteristics.full_vector (tsvector GIN)
-- =====================================================
-- Utilisé dans la requête simplifiée pour recherche dans full_vector
CREATE INDEX IF NOT EXISTS idx_autocomplete_full_vector_tsvector_gin 
ON autocomplete_characteristics 
USING GIN (full_vector_to_tsvector(full_vector))
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- =====================================================
-- 5. Index sur autocomplete_characteristics.characteristic_vector (tsvector GIN)
-- =====================================================
-- Utilisé dans la requête simplifiée pour recherche dans characteristic_vector
CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristic_vector_tsvector_gin 
ON autocomplete_characteristics 
USING GIN (characteristic_vector_to_tsvector(characteristic_vector))
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- =====================================================
-- 6. Vérifier que les fonctions helper existent
-- =====================================================

-- Fonction full_vector_to_tsvector (doit exister)
CREATE OR REPLACE FUNCTION full_vector_to_tsvector(char_vec TEXT[])
RETURNS tsvector AS $$
BEGIN
    RETURN to_tsvector('french', array_to_string(COALESCE(char_vec, ARRAY[]::TEXT[]), ' '));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction characteristic_vector_to_tsvector (doit exister)
CREATE OR REPLACE FUNCTION characteristic_vector_to_tsvector(char_vec TEXT[])
RETURNS tsvector AS $$
BEGIN
    RETURN to_tsvector('french', array_to_string(COALESCE(char_vec, ARRAY[]::TEXT[]), ' '));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 7. Analyser les tables pour mettre à jour les statistiques
-- =====================================================
ANALYZE services;
ANALYZE autocomplete_characteristics;

-- =====================================================
-- 8. Vérification finale
-- =====================================================
DO $$
DECLARE
    idx_count INTEGER;
BEGIN
    -- Compter les index tsvector sur services
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes
    WHERE tablename = 'services'
    AND indexdef LIKE '%to_tsvector%';
    
    RAISE NOTICE '📊 Index tsvector sur services: %', idx_count;
    
    -- Compter les index tsvector sur autocomplete_characteristics
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes
    WHERE tablename = 'autocomplete_characteristics'
    AND indexdef LIKE '%to_tsvector%';
    
    RAISE NOTICE '📊 Index tsvector sur autocomplete_characteristics: %', idx_count;
    
    RAISE NOTICE '✅ Migration terminée - Tous les index nécessaires sont en place';
END $$;



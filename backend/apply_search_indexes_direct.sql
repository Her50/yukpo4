-- ✅ Script direct pour appliquer les index de recherche
-- Exécuter directement avec: psql $DATABASE_URL -f apply_search_indexes_direct.sql

-- =====================================================
-- 1. Index sur autocomplete_characteristics.valeur (tsvector GIN)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristics_valeur_tsvector 
ON autocomplete_characteristics 
USING GIN (to_tsvector('french', valeur))
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- =====================================================
-- 2. Index sur services.data->'titre_service'->>'valeur' (tsvector GIN)
-- =====================================================
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
CREATE INDEX IF NOT EXISTS idx_autocomplete_full_vector_tsvector_gin 
ON autocomplete_characteristics 
USING GIN (full_vector_to_tsvector(full_vector))
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- =====================================================
-- 5. Index sur autocomplete_characteristics.characteristic_vector (tsvector GIN)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristic_vector_tsvector_gin 
ON autocomplete_characteristics 
USING GIN (characteristic_vector_to_tsvector(characteristic_vector))
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- =====================================================
-- 6. Fonctions helper (si n'existent pas)
-- =====================================================
CREATE OR REPLACE FUNCTION full_vector_to_tsvector(char_vec TEXT[])
RETURNS tsvector AS $$
BEGIN
    RETURN to_tsvector('french', array_to_string(COALESCE(char_vec, ARRAY[]::TEXT[]), ' '));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION characteristic_vector_to_tsvector(char_vec TEXT[])
RETURNS tsvector AS $$
BEGIN
    RETURN to_tsvector('french', array_to_string(COALESCE(char_vec, ARRAY[]::TEXT[]), ' '));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 7. Analyser les tables
-- =====================================================
ANALYZE services;
ANALYZE autocomplete_characteristics;

-- =====================================================
-- 8. Vérification
-- =====================================================
SELECT 
    'Index tsvector sur services' as type,
    COUNT(*) as count
FROM pg_indexes
WHERE tablename = 'services'
AND indexdef LIKE '%to_tsvector%'

UNION ALL

SELECT 
    'Index tsvector sur autocomplete_characteristics' as type,
    COUNT(*) as count
FROM pg_indexes
WHERE tablename = 'autocomplete_characteristics'
AND indexdef LIKE '%to_tsvector%';



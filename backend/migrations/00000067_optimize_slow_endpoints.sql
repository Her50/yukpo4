-- Migration pour optimiser les endpoints lents identifiés dans les logs
-- Date: 2025-12-21
-- Problèmes identifiés:
-- 1. /api/services/{id}/stats et /api/services/{id}/reviews: Requêtes MongoDB lentes (2-3s)
-- 2. /api/search/direct et /api/autocomplete/search-products: array_to_string() ne peut pas utiliser l'index GIN
-- 3. Requête principale dans native_search_service.rs prend 1.745s

-- ✅ OPTIMISATION 1: Créer une fonction IMMUTABLE pour convertir full_vector en tsvector
-- Le problème: array_to_string() n'est pas IMMUTABLE, donc ne peut pas être utilisée dans un index
-- Solution: Créer une fonction IMMUTABLE qui fait la conversion
CREATE OR REPLACE FUNCTION full_vector_to_tsvector(full_vec TEXT[]) RETURNS tsvector AS $$
BEGIN
    RETURN to_tsvector('french', array_to_string(COALESCE(full_vec, ARRAY[]::TEXT[]), ' '));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ✅ OPTIMISATION 2: Créer une fonction IMMUTABLE pour convertir characteristic_vector en tsvector
CREATE OR REPLACE FUNCTION characteristic_vector_to_tsvector(char_vec TEXT[]) RETURNS tsvector AS $$
BEGIN
    RETURN to_tsvector('french', array_to_string(COALESCE(char_vec, ARRAY[]::TEXT[]), ' '));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ✅ OPTIMISATION 3: Créer un index GIN sur full_vector pour recherche tsvector
CREATE INDEX IF NOT EXISTS idx_autocomplete_full_vector_tsvector_gin 
ON autocomplete_characteristics 
USING GIN (full_vector_to_tsvector(full_vector))
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- ✅ OPTIMISATION 4: Créer un index GIN sur characteristic_vector pour recherche tsvector
CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristic_vector_tsvector_gin 
ON autocomplete_characteristics 
USING GIN (characteristic_vector_to_tsvector(characteristic_vector))
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- ✅ OPTIMISATION 5: Créer un index composite pour optimiser les requêtes fréquentes
-- Index sur (identifiant_base, is_real_product, service_id) pour accélérer les JOINs
CREATE INDEX IF NOT EXISTS idx_autocomplete_composite_search 
ON autocomplete_characteristics (identifiant_base, is_real_product, service_id)
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- ✅ OPTIMISATION 6: Créer un index sur services.is_active pour accélérer les filtres
CREATE INDEX IF NOT EXISTS idx_services_is_active 
ON services (is_active)
WHERE is_active = TRUE;

-- ✅ OPTIMISATION 7: Créer un index sur services.category pour accélérer les filtres de catégorie
CREATE INDEX IF NOT EXISTS idx_services_category 
ON services (category)
WHERE is_active = TRUE AND category IS NOT NULL;

-- ✅ OPTIMISATION 8: Analyser les tables pour mettre à jour les statistiques
ANALYZE autocomplete_characteristics;
ANALYZE services;

-- Note: Les optimisations MongoDB (index sur service_id et event_type) doivent être faites
-- directement dans MongoDB, pas dans cette migration SQL.


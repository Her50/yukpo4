-- Migration pour corriger l'erreur "index row requires 416920 bytes, maximum size is 8191"
-- Date: 2025-10-31
-- Description: Supprime l'index GIN problématique sur data->'produits' qui essaie d'indexer 
--              des données volumineuses (images base64, etc.) et le remplace par un index optimisé

-- 1. Supprimer l'index problématique qui indexe directement tout le champ produits
DROP INDEX IF EXISTS idx_services_products_gin;

-- 2. Supprimer aussi l'index sur le type (pas très utile pour un champ JSONB)
DROP INDEX IF EXISTS idx_services_products_type;

-- 3. L'index idx_services_products_fulltext_all est déjà présent et utilise une fonction
--    qui extrait seulement le texte (pas les images), donc il n'y a pas de problème de taille.
--    Cet index sera utilisé pour les recherches full-text dans les produits.

-- 4. Fonction utilitaire pour extraire un champ spécifique des produits en tableau TEXT[]
CREATE OR REPLACE FUNCTION extract_service_products_field(service_data JSONB, field_name TEXT)
RETURNS TEXT[] AS $$
DECLARE
    products JSONB;
    product_record JSONB;
    result TEXT[];
    field_value TEXT;
BEGIN
    products := CASE 
        WHEN jsonb_typeof(service_data->'produits') = 'array' 
        THEN service_data->'produits'
        ELSE '[]'::jsonb
    END;

    result := ARRAY[]::TEXT[];

    FOR product_record IN SELECT * FROM jsonb_array_elements(products)
    LOOP
        field_value := product_record->>field_name;
        IF field_value IS NOT NULL AND field_value <> '' THEN
            result := array_append(result, field_value);
        END IF;
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Créer un index optimisé pour les recherches par type de produit (plus léger)
CREATE INDEX IF NOT EXISTS idx_services_products_type_optimized 
ON services USING GIN (extract_service_products_field(data, 'type'))
WHERE data->'produits' IS NOT NULL;

-- 6. Créer un index optimisé pour les recherches par nom de produit (plus léger)
CREATE INDEX IF NOT EXISTS idx_services_products_nom_optimized 
ON services USING GIN (extract_service_products_field(data, 'nom'))
WHERE data->'produits' IS NOT NULL;

-- Commentaires
COMMENT ON INDEX idx_services_products_type_optimized IS 'Index optimisé pour recherche par type de produit (évite d''indexer les images base64)';
COMMENT ON INDEX idx_services_products_nom_optimized IS 'Index optimisé pour recherche par nom de produit (évite d''indexer les images base64)';


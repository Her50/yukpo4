-- Migration : Ajouter product_labels et location_labels à autocomplete_combinations
-- Date : 2025-11-05
-- Description : Ajoute les colonnes manquantes utilisées par le code Rust
-- Compatible SQLx offline mode

-- ✅ ÉTAPE 1 : Ajouter product_labels (étiquettes pour product_vector)
ALTER TABLE autocomplete_combinations 
ADD COLUMN IF NOT EXISTS product_labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ✅ ÉTAPE 2 : Ajouter location_labels (étiquettes pour location_vector)
ALTER TABLE autocomplete_combinations 
ADD COLUMN IF NOT EXISTS location_labels TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ✅ ÉTAPE 3 : Ajouter session_id (pour traçabilité IA)
ALTER TABLE autocomplete_combinations 
ADD COLUMN IF NOT EXISTS session_id TEXT;

-- ✅ ÉTAPE 4 : Mettre à jour la fonction upsert pour inclure les labels
CREATE OR REPLACE FUNCTION upsert_autocomplete_combination(
    p_product_vector TEXT[],
    p_location_vector TEXT[],
    p_full_vector TEXT[],
    p_product_labels TEXT[],
    p_location_labels TEXT[],
    p_chosen_location TEXT,
    p_is_ai_preferred BOOLEAN,
    p_ai_confidence FLOAT,
    p_session_id TEXT,
    p_has_variant BOOLEAN,
    p_variant_dimension TEXT,
    p_variant_value TEXT,
    p_prix DECIMAL(12, 2),
    p_devise TEXT,
    p_stock INTEGER,
    p_service_id INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
    v_existing_count INTEGER;
BEGIN
    SELECT id, usage_count INTO v_id, v_existing_count
    FROM autocomplete_combinations
    WHERE full_vector = p_full_vector;
    
    IF FOUND THEN
        UPDATE autocomplete_combinations
        SET 
            usage_count = usage_count + 1,
            is_ai_preferred = CASE WHEN p_is_ai_preferred THEN TRUE ELSE is_ai_preferred END,
            ai_confidence = GREATEST(ai_confidence, p_ai_confidence),
            service_id = COALESCE(p_service_id, service_id),
            product_labels = p_product_labels,
            location_labels = p_location_labels,
            updated_at = NOW()
        WHERE id = v_id;
        RETURN v_id;
    ELSE
        INSERT INTO autocomplete_combinations (
            service_id, product_vector, product_labels, location_vector, location_labels, full_vector,
            chosen_location, usage_count, is_ai_preferred, ai_confidence,
            session_id, has_variant, variant_dimension, variant_value,
            prix, devise, stock
        ) VALUES (
            p_service_id, p_product_vector, p_product_labels, p_location_vector, p_location_labels, p_full_vector,
            p_chosen_location, 1, p_is_ai_preferred, p_ai_confidence,
            p_session_id, p_has_variant, p_variant_dimension, p_variant_value,
            p_prix, p_devise, p_stock
        )
        RETURNING id INTO v_id;
        RETURN v_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ✅ ÉTAPE 5 : Créer fonction extract_all_product_text pour recherche full-text
CREATE OR REPLACE FUNCTION extract_all_product_text(product JSONB)
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(product->>'nom', '') || ' ' ||
           COALESCE(product->>'categorie', '') || ' ' ||
           COALESCE(product->>'description', '') || ' ' ||
           COALESCE(product->>'type', '') || ' ' ||
           COALESCE(product->>'marque', '') || ' ' ||
           COALESCE(product->>'modele', '') || ' ' ||
           COALESCE(product->>'titre', '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ✅ ÉTAPE 6 : Ajouter product_labels à autocomplete_characteristics (si manquante)
ALTER TABLE autocomplete_characteristics 
ADD COLUMN IF NOT EXISTS product_labels TEXT[] DEFAULT '{}';

-- ✅ ÉTAPE 7 : Commentaires pour documentation
COMMENT ON COLUMN autocomplete_combinations.product_labels IS 
'Étiquettes pour chaque élément du product_vector. Permet get_vector_value_by_label()';

COMMENT ON COLUMN autocomplete_combinations.location_labels IS 
'Étiquettes pour chaque élément du location_vector. Permet filtrage géographique intelligent';

COMMENT ON COLUMN autocomplete_combinations.session_id IS 
'ID de session IA pour regrouper les combinaisons générées ensemble et traçabilité';

COMMENT ON FUNCTION extract_all_product_text IS 
'Extrait tous les champs texte d''un produit JSONB pour recherche full-text optimisée';



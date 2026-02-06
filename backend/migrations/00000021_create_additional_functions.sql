-- Fonctions supplémentaires pour autocomplete et autres fonctionnalités

-- Fonction : Mettre à jour updated_at pour autocomplete_characteristics
CREATE OR REPLACE FUNCTION update_autocomplete_characteristics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger : Appliquer update_autocomplete_characteristics_updated_at
DROP TRIGGER IF EXISTS trigger_autocomplete_characteristics_updated_at ON autocomplete_characteristics;
CREATE TRIGGER trigger_autocomplete_characteristics_updated_at
    BEFORE UPDATE ON autocomplete_characteristics
    FOR EACH ROW
    EXECUTE FUNCTION update_autocomplete_characteristics_updated_at();

-- Fonction : Upsert caractéristique autocomplete (incrémenter usage_count si existe)
CREATE OR REPLACE FUNCTION upsert_autocomplete_characteristic(
    p_identifiant_base VARCHAR(255),
    p_sous_caracteristique VARCHAR(255),
    p_valeur VARCHAR(500),
    p_origine_champs VARCHAR(50) DEFAULT 'ia',
    p_user_id INTEGER DEFAULT NULL,
    p_service_id INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO autocomplete_characteristics (
        identifiant_base,
        sous_caracteristique,
        valeur,
        origine_champs,
        user_id,
        service_id,
        usage_count
    )
    VALUES (
        p_identifiant_base,
        p_sous_caracteristique,
        p_valeur,
        p_origine_champs,
        p_user_id,
        p_service_id,
        1
    )
    ON CONFLICT (identifiant_base, sous_caracteristique, valeur)
    DO UPDATE SET
        usage_count = autocomplete_characteristics.usage_count + 1,
        updated_at = NOW();
    
    SELECT id INTO v_id
    FROM autocomplete_characteristics
    WHERE identifiant_base = p_identifiant_base
    AND sous_caracteristique = p_sous_caracteristique
    AND valeur = p_valeur;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction : Mettre à jour updated_at pour autocomplete_combinations
CREATE OR REPLACE FUNCTION update_combinations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger : Appliquer update_combinations_updated_at
DROP TRIGGER IF EXISTS trigger_combinations_updated_at ON autocomplete_combinations;
CREATE TRIGGER trigger_combinations_updated_at
    BEFORE UPDATE ON autocomplete_combinations
    FOR EACH ROW
    EXECUTE FUNCTION update_combinations_updated_at();

-- Fonction : Upsert combinaison autocomplete (avec labels)
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
    p_prix NUMERIC,
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

-- Fonction : Calculer le score de localisation pour autocomplete
CREATE OR REPLACE FUNCTION calculate_location_score(
    search_location TEXT,
    location_vector TEXT[],
    chosen_location TEXT
)
RETURNS FLOAT AS $$
DECLARE
    score FLOAT := 0.0;
    search_lower TEXT;
    i INTEGER;
    vec_length INTEGER;
BEGIN
    IF search_location IS NULL OR location_vector IS NULL THEN
        RETURN 0.0;
    END IF;
    
    search_lower := LOWER(search_location);
    vec_length := array_length(location_vector, 1);

    IF vec_length IS NULL OR vec_length < 1 THEN
        RETURN 0.0;
    END IF;
    
    IF chosen_location IS NOT NULL AND LOWER(chosen_location) = search_lower THEN
        RETURN 1.0;
    END IF;
    
    FOR i IN 1..vec_length LOOP
        IF LOWER(location_vector[i]) = search_lower THEN
            score := 1.0 - (i - 1) * 0.1;
            EXIT;
        ELSIF LOWER(location_vector[i]) LIKE '%' || search_lower || '%' THEN
            score := 0.5 - (i - 1) * 0.1;
        END IF;
    END LOOP;
    
    RETURN GREATEST(score, 0.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction : Extraire une valeur du vecteur par son label
-- Ex: get_vector_value_by_label(["Nike", "Air Max", "Noir"], ["marque", "modele", "couleur"], "couleur") → "Noir"
CREATE OR REPLACE FUNCTION get_vector_value_by_label(
    p_vector TEXT[],
    p_labels TEXT[],
    p_search_label TEXT
)
RETURNS TEXT AS $$
DECLARE
    i INTEGER;
    vector_length INTEGER;
BEGIN
    IF p_vector IS NULL OR p_labels IS NULL OR p_search_label IS NULL THEN
        RETURN NULL;
    END IF;
    
    vector_length := array_length(p_vector, 1);

    IF vector_length IS NULL OR vector_length < 1 THEN
        RETURN NULL;
    END IF;

    IF vector_length != array_length(p_labels, 1) THEN
        RETURN NULL;
    END IF;
    
    FOR i IN 1..vector_length LOOP
        IF LOWER(p_labels[i]) = LOWER(p_search_label) THEN
            RETURN p_vector[i];
        END IF;
    END LOOP;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction : Convertir vecteur + labels en JSONB structuré
-- Ex: vector_to_jsonb(["Nike", "Air Max", "Noir"], ["marque", "modele", "couleur"]) 
--     → {"marque": "Nike", "modele": "Air Max", "couleur": "Noir"}
CREATE OR REPLACE FUNCTION vector_to_jsonb(
    p_vector TEXT[],
    p_labels TEXT[]
)
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}'::JSONB;
    i INTEGER;
    vector_length INTEGER;
BEGIN
    IF p_vector IS NULL OR p_labels IS NULL THEN
        RETURN result;
    END IF;
    
    vector_length := array_length(p_vector, 1);

    IF vector_length IS NULL OR vector_length < 1 THEN
        RETURN result;
    END IF;
    
    IF vector_length != array_length(p_labels, 1) THEN
        RETURN result;
    END IF;
    
    FOR i IN 1..vector_length LOOP
        result := result || jsonb_build_object(p_labels[i], p_vector[i]);
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;




-- Migration : Corriger autocomplete_combinations selon la logique finale
-- Date : 2025-11-04
-- Description : 
--   - Supprimer chosen_location et chosen_location_geoname_id (pas utile, lieu uniquement dans autocomplete_characteristics)
--   - Supprimer location_vector (pas utile ici)
--   - Modifier contrainte unique pour vérifier doublons sur product_vector uniquement
-- Compatible SQLx offline mode

-- ✅ ÉTAPE 1 : Marquer les colonnes lieu comme DEPRECATED
-- Note: On garde les colonnes pour compatibilité mais on ne les utilise plus
COMMENT ON COLUMN autocomplete_combinations.location_vector IS 
'DEPRECATED: Ne plus utiliser. Le vecteur lieu est stocké UNIQUEMENT dans autocomplete_characteristics (vrais produits prestataires)';

COMMENT ON COLUMN autocomplete_combinations.chosen_location IS 
'DEPRECATED: Ne plus utiliser. Le lieu choisi est stocké UNIQUEMENT dans autocomplete_characteristics';

-- Note: chosen_location_geoname_id n'existe pas encore dans les anciennes tables, donc pas besoin de le marquer DEPRECATED

-- ✅ ÉTAPE 3 : Modifier la contrainte unique
-- Supprimer l'ancienne contrainte sur full_vector
ALTER TABLE autocomplete_combinations
DROP CONSTRAINT IF EXISTS unique_full_vector;

-- Ajouter contrainte unique sur product_vector seulement
-- Permet de détecter les doublons lors du chargement JSON IA
ALTER TABLE autocomplete_combinations
ADD CONSTRAINT unique_product_vector UNIQUE (product_vector);

-- Note : Cette contrainte permettra de vérifier si une combinaison existe déjà
-- Lors du chargement JSON IA : si product_vector existe → ne PAS insérer (éviter bruit)
-- Lors du choix prestataire : insérer quand même (doublons OK pour popularité)

-- ✅ ÉTAPE 4 : Fonction pour vérifier si une combinaison produit existe déjà
CREATE OR REPLACE FUNCTION product_combination_exists(
    p_product_vector TEXT[]
)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM autocomplete_combinations
        WHERE product_vector = p_product_vector
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql STABLE;

-- ✅ ÉTAPE 5 : Fonction pour insérer combinaison IA (avec vérification doublon)
CREATE OR REPLACE FUNCTION insert_ia_combination_if_not_exists(
    p_product_vector TEXT[],
    p_session_id TEXT DEFAULT NULL,
    p_is_ai_preferred BOOLEAN DEFAULT FALSE,
    p_ai_confidence FLOAT DEFAULT 0.0,
    p_has_variant BOOLEAN DEFAULT FALSE,
    p_variant_dimension TEXT DEFAULT NULL,
    p_variant_value TEXT DEFAULT NULL,
    p_prix DECIMAL(12, 2) DEFAULT NULL,
    p_devise TEXT DEFAULT 'XAF',
    p_stock INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER := NULL;
BEGIN
    -- Vérifier si la combinaison existe déjà
    IF NOT product_combination_exists(p_product_vector) THEN
        -- Insérer seulement si elle n'existe pas (éviter bruit)
        INSERT INTO autocomplete_combinations (
            service_id,  -- NULL car généré par IA avant création service
            product_vector,
            location_vector,  -- Vide car pas utilisé pour combinaisons IA
            full_vector,      -- = product_vector (sans lieu)
            chosen_location,  -- NULL
            chosen_location_geoname_id,  -- NULL
            session_id,
            is_ai_preferred,
            ai_confidence,
            has_variant,
            variant_dimension,
            variant_value,
            prix,
            devise,
            stock,
            usage_count
        )
        VALUES (
            NULL,
            p_product_vector,
            '{}',  -- Vide
            p_product_vector,  -- Sans lieu
            NULL,
            NULL,
            p_session_id,
            p_is_ai_preferred,
            p_ai_confidence,
            p_has_variant,
            p_variant_dimension,
            p_variant_value,
            p_prix,
            p_devise,
            p_stock,
            1
        )
        RETURNING id INTO v_id;
        
        RETURN v_id;
    ELSE
        -- Combinaison existe déjà, retourner NULL (pas d'insertion)
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ✅ ÉTAPE 6 : Fonction pour insérer produit réel choisi par prestataire (avec lieu)
-- Note : Les doublons sont ACCEPTÉS (c'est voulu pour la popularité)
CREATE OR REPLACE FUNCTION insert_provider_product_combination(
    p_service_id INTEGER,
    p_product_vector TEXT[],
    p_chosen_location TEXT DEFAULT NULL,
    p_chosen_location_geoname_id BIGINT DEFAULT NULL,
    p_has_variant BOOLEAN DEFAULT FALSE,
    p_variant_dimension TEXT DEFAULT NULL,
    p_variant_value TEXT DEFAULT NULL,
    p_prix DECIMAL(12, 2) DEFAULT NULL,
    p_devise TEXT DEFAULT 'XAF',
    p_stock INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    -- Toujours insérer (doublons OK pour popularité)
    INSERT INTO autocomplete_combinations (
        service_id,
        product_vector,
        location_vector,  -- Vide (lieu seulement dans autocomplete_characteristics)
        full_vector,      -- = product_vector (sans lieu)
        chosen_location,
        chosen_location_geoname_id,
        has_variant,
        variant_dimension,
        variant_value,
        prix,
        devise,
        stock,
        usage_count
    )
    VALUES (
        p_service_id,
        p_product_vector,
        '{}',  -- Vide
        p_product_vector,  -- Sans lieu
        p_chosen_location,
        p_chosen_location_geoname_id,
        p_has_variant,
        p_variant_dimension,
        p_variant_value,
        p_prix,
        p_devise,
        p_stock,
        1
    )
    ON CONFLICT (product_vector)
    DO UPDATE SET
        usage_count = autocomplete_combinations.usage_count + 1,
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ✅ ÉTAPE 7 : Commentaires pour documentation
COMMENT ON COLUMN autocomplete_combinations.characteristic_vector IS 
'DEPRECATED: Utiliser product_vector à la place';

COMMENT ON COLUMN autocomplete_combinations.chosen_location_geoname_id IS 
'ID GeoNames du lieu choisi par le prestataire. GARANTIT l''unicité du lieu';

COMMENT ON CONSTRAINT unique_product_vector ON autocomplete_combinations IS 
'Contrainte unique sur product_vector pour détecter doublons lors chargement JSON IA. Les doublons de produits réels prestataires sont gérés par usage_count';

COMMENT ON FUNCTION product_combination_exists IS 
'Vérifie si une combinaison produit existe déjà dans autocomplete_combinations. Utilisé lors du chargement JSON IA pour éviter le bruit';

COMMENT ON FUNCTION insert_ia_combination_if_not_exists IS 
'Insère une combinaison IA seulement si elle n''existe pas déjà (évite doublons). Utilisé lors du chargement des suggestions IA';

COMMENT ON FUNCTION insert_provider_product_combination IS 
'Insère un produit réel choisi par prestataire. Les doublons sont ACCEPTÉS et gérés par usage_count pour calculer la popularité';



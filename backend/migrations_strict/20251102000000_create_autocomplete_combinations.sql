-- Migration: Créer table autocomplete_combinations pour stocker les vecteurs complets de produits
-- Date: 2025-11-02
-- Description: Table pour stocker toutes les combinaisons vectorielles possibles générées par l'IA
--              Permet la recherche intelligente et la sélection dans le formulaire de création produit
-- Compatible SQLx offline mode

-- Créer la table autocomplete_combinations
CREATE TABLE IF NOT EXISTS autocomplete_combinations (
    id SERIAL PRIMARY KEY,
    
    -- Service associé (peut être NULL si combinaison générée avant création du service)
    service_id INTEGER,
    
    -- Vecteur produit (caractéristiques hors localisation)
    -- Ex: ["Nike", "Air Max", "Noir", "Neuf", "42"]
    product_vector TEXT[] NOT NULL,
    
    -- Vecteur localisation (hiérarchie géographique)
    -- Ex: ["Douala", "Akwa", "Littoral", "Cameroun"]
    location_vector TEXT[] DEFAULT '{}',
    
    -- Vecteur complet (product_vector + location_vector)
    -- Ex: ["Nike", "Air Max", "Noir", "Neuf", "42", "Douala", "Akwa", "Littoral", "Cameroun"]
    full_vector TEXT[] NOT NULL,
    
    -- Localisation choisie (dernier élément clé du location_vector)
    -- Ex: "Douala" ou "Akwa"
    chosen_location TEXT,
    
    -- Compteur d'utilisation (popularité)
    usage_count INTEGER DEFAULT 1,
    
    -- Indicateur de choix AI (TRUE si c'est la combinaison préférée par l'IA)
    is_ai_preferred BOOLEAN DEFAULT FALSE,
    
    -- Confiance IA (0.0 à 1.0)
    ai_confidence FLOAT DEFAULT 0.0,
    
    -- Session ID pour traçabilité (lien avec la génération IA)
    session_id TEXT,
    
    -- Variabilité de prix (si applicable)
    has_variant BOOLEAN DEFAULT FALSE,
    variant_dimension TEXT, -- Ex: "pointure", "taille", "capacité"
    variant_value TEXT, -- Ex: "42", "M", "128GB"
    
    -- Prix et stock (si disponibles)
    prix DECIMAL(12, 2),
    devise TEXT DEFAULT 'XAF',
    stock INTEGER,
    
    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contrainte d'unicité : même vecteur complet = même entrée
    CONSTRAINT unique_full_vector UNIQUE (full_vector)
);

-- Index pour recherche par service_id (avec filtre partiel)
CREATE INDEX IF NOT EXISTS idx_combinations_service_id 
    ON autocomplete_combinations(service_id) 
    WHERE service_id IS NOT NULL;

-- Index pour recherche par session (toutes les combinaisons d'une session AI)
CREATE INDEX IF NOT EXISTS idx_combinations_session 
    ON autocomplete_combinations(session_id);

-- Index pour recherche par choix AI préféré (avec filtre partiel)
CREATE INDEX IF NOT EXISTS idx_combinations_ai_preferred 
    ON autocomplete_combinations(is_ai_preferred) 
    WHERE is_ai_preferred = TRUE;

-- Index GIN pour recherche vectorielle rapide dans product_vector
CREATE INDEX IF NOT EXISTS idx_combinations_product_vector_gin 
    ON autocomplete_combinations USING GIN(product_vector);

-- Index GIN pour recherche vectorielle rapide dans location_vector
CREATE INDEX IF NOT EXISTS idx_combinations_location_vector_gin 
    ON autocomplete_combinations USING GIN(location_vector);

-- Index GIN pour recherche vectorielle rapide dans full_vector
CREATE INDEX IF NOT EXISTS idx_combinations_full_vector_gin 
    ON autocomplete_combinations USING GIN(full_vector);

-- Index pour tri par popularité (DESC pour ORDER BY optimization)
CREATE INDEX IF NOT EXISTS idx_combinations_usage_count 
    ON autocomplete_combinations(usage_count DESC);

-- Index composite pour recherche avec filtres de localisation
CREATE INDEX IF NOT EXISTS idx_combinations_location_usage 
    ON autocomplete_combinations(chosen_location, usage_count DESC);

-- Index pour recherche avec variabilité
CREATE INDEX IF NOT EXISTS idx_combinations_variant 
    ON autocomplete_combinations(has_variant, variant_dimension, variant_value);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_combinations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_combinations_updated_at ON autocomplete_combinations;
CREATE TRIGGER trigger_combinations_updated_at
    BEFORE UPDATE ON autocomplete_combinations
    FOR EACH ROW
    EXECUTE FUNCTION update_combinations_updated_at();

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc 
        WHERE proname = 'upsert_autocomplete_combination'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', rec.func_signature);
    END LOOP;
END $$;

-- Fonction pour upsert une combinaison (incrémenter usage_count si existe)
CREATE OR REPLACE FUNCTION upsert_autocomplete_combination(
    p_product_vector TEXT[],
    p_location_vector TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_full_vector TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_chosen_location TEXT DEFAULT NULL,
    p_is_ai_preferred BOOLEAN DEFAULT FALSE,
    p_ai_confidence FLOAT DEFAULT 0.0,
    p_session_id TEXT DEFAULT NULL,
    p_has_variant BOOLEAN DEFAULT FALSE,
    p_variant_dimension TEXT DEFAULT NULL,
    p_variant_value TEXT DEFAULT NULL,
    p_prix DECIMAL(12, 2) DEFAULT NULL,
    p_devise TEXT DEFAULT 'XAF',
    p_stock INTEGER DEFAULT NULL,
    p_service_id INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
    v_existing_count INTEGER;
BEGIN
    -- Vérifier si la combinaison existe déjà
    SELECT id, usage_count INTO v_id, v_existing_count
    FROM autocomplete_combinations
    WHERE full_vector = p_full_vector;
    
    IF FOUND THEN
        -- Mise à jour : incrémenter usage_count
        UPDATE autocomplete_combinations
        SET 
            usage_count = usage_count + 1,
            is_ai_preferred = CASE 
                WHEN p_is_ai_preferred THEN TRUE 
                ELSE is_ai_preferred 
            END,
            ai_confidence = GREATEST(ai_confidence, p_ai_confidence),
            service_id = COALESCE(p_service_id, service_id),
            updated_at = NOW()
        WHERE id = v_id;
        
        RETURN v_id;
    ELSE
        -- Insertion nouvelle combinaison
        INSERT INTO autocomplete_combinations (
            service_id,
            product_vector,
            location_vector,
            full_vector,
            chosen_location,
            usage_count,
            is_ai_preferred,
            ai_confidence,
            session_id,
            has_variant,
            variant_dimension,
            variant_value,
            prix,
            devise,
            stock
        )
        VALUES (
            p_service_id,
            p_product_vector,
            p_location_vector,
            p_full_vector,
            p_chosen_location,
            1,
            p_is_ai_preferred,
            p_ai_confidence,
            p_session_id,
            p_has_variant,
            p_variant_dimension,
            p_variant_value,
            p_prix,
            p_devise,
            p_stock
        )
        RETURNING id INTO v_id;
        
        RETURN v_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer le score de localisation (proximité géographique)
-- Utilisée pour trier les résultats par pertinence géographique
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
    
    -- Correspondance exacte avec chosen_location (score max)
    IF chosen_location IS NOT NULL AND LOWER(chosen_location) = search_lower THEN
        RETURN 1.0;
    END IF;
    
    -- Recherche dans le vecteur de localisation
    FOR i IN 1..vec_length LOOP
        IF LOWER(location_vector[i]) = search_lower THEN
            -- Score dépend de la position dans la hiérarchie
            -- Position 1 (ville) = 1.0, Position 2 (quartier) = 0.9, etc.
            score := 1.0 - (i - 1) * 0.1;
            EXIT;
        ELSIF LOWER(location_vector[i]) LIKE '%' || search_lower || '%' THEN
            -- Correspondance partielle (score réduit)
            score := 0.5 - (i - 1) * 0.1;
        END IF;
    END LOOP;
    
    RETURN GREATEST(score, 0.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Commentaires pour documentation
COMMENT ON TABLE autocomplete_combinations IS 'Stockage des combinaisons vectorielles complètes de produits pour recherche intelligente';
COMMENT ON COLUMN autocomplete_combinations.product_vector IS 'Vecteur caractéristiques produit sans localisation';
COMMENT ON COLUMN autocomplete_combinations.location_vector IS 'Vecteur hiérarchie géographique';
COMMENT ON COLUMN autocomplete_combinations.full_vector IS 'Vecteur complet (product + location)';
COMMENT ON COLUMN autocomplete_combinations.is_ai_preferred IS 'TRUE si combinaison préférée par IA (affichée en premier)';
COMMENT ON COLUMN autocomplete_combinations.session_id IS 'ID de session IA pour regrouper les combinaisons générées ensemble';
COMMENT ON COLUMN autocomplete_combinations.usage_count IS 'Nombre d''utilisations (popularité)';
COMMENT ON FUNCTION upsert_autocomplete_combination IS 'Insère ou met à jour une combinaison autocomplete avec incrément du compteur d''usage';
COMMENT ON FUNCTION calculate_location_score IS 'Calcule le score de pertinence géographique pour le tri des résultats';


-- Tables autocomplete pour recherche intelligente

-- Table autocomplete_characteristics (mise à jour 2025-11-04 - vectorielle)
-- Stocke les VRAIS produits validés par les prestataires (mode vectoriel)
-- Permet la recherche intelligente avec filtre lieu intégré
CREATE TABLE IF NOT EXISTS autocomplete_characteristics (
    id SERIAL PRIMARY KEY,
    identifiant_base VARCHAR(255) NOT NULL,
    
    -- Mode vectoriel (nouveaux champs 2025-11-04)
    characteristic_vector TEXT[] DEFAULT '{}',  -- Vecteur produit validé par prestataire
    location_vector TEXT[] DEFAULT '{}',        -- Vecteur lieu bidirectionnel (lieu choisi TOUJOURS en position 0)
    full_vector TEXT[] DEFAULT '{}',            -- characteristic_vector + location_vector
    product_id TEXT,                            -- Format: "serviceId_productIndex"
    chosen_location TEXT,                       -- Lieu choisi (position 0 du location_vector)
    chosen_location_geoname_id BIGINT,         -- ID GeoNames (GARANTIT unicité)
    is_real_product BOOLEAN DEFAULT TRUE,      -- TRUE = produit réel prestataire
    
    -- Mode individuel (ancien, conservé pour compatibilité)
    sous_caracteristique VARCHAR(255),
    valeur VARCHAR(500),
    
    -- Métadonnées
    origine_champs VARCHAR(50) NOT NULL DEFAULT 'ia',
    user_id INTEGER,
    service_id INTEGER,
    usage_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour autocomplete_characteristics (mode individuel - ancien)
CREATE INDEX IF NOT EXISTS idx_autocomplete_identifiant_base ON autocomplete_characteristics(identifiant_base);
CREATE INDEX IF NOT EXISTS idx_autocomplete_sous_caracteristique ON autocomplete_characteristics(sous_caracteristique);
CREATE INDEX IF NOT EXISTS idx_autocomplete_base_sous ON autocomplete_characteristics(identifiant_base, sous_caracteristique);
CREATE INDEX IF NOT EXISTS idx_autocomplete_valeur_lower ON autocomplete_characteristics(LOWER(valeur));
CREATE INDEX IF NOT EXISTS idx_autocomplete_origine ON autocomplete_characteristics(origine_champs);
CREATE INDEX IF NOT EXISTS idx_autocomplete_usage_count ON autocomplete_characteristics(identifiant_base, sous_caracteristique, usage_count DESC);

-- Index pour autocomplete_characteristics (mode vectoriel - nouveau 2025-11-04)
CREATE INDEX IF NOT EXISTS idx_autochar_characteristic_vector_gin ON autocomplete_characteristics USING GIN(characteristic_vector);
CREATE INDEX IF NOT EXISTS idx_autochar_location_vector_gin ON autocomplete_characteristics USING GIN(location_vector);
CREATE INDEX IF NOT EXISTS idx_autochar_full_vector_gin ON autocomplete_characteristics USING GIN(full_vector);
CREATE INDEX IF NOT EXISTS idx_autochar_product_id ON autocomplete_characteristics(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_autochar_geoname_id ON autocomplete_characteristics(chosen_location_geoname_id) WHERE chosen_location_geoname_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_autochar_location_usage ON autocomplete_characteristics(chosen_location, usage_count DESC) WHERE chosen_location IS NOT NULL;

-- ✅ OPTIMISÉ 2025-01-14: Index composites pour améliorer les performances autocomplete
CREATE INDEX IF NOT EXISTS idx_autocomplete_real_product_composite 
ON autocomplete_characteristics(identifiant_base, is_real_product, service_id) 
WHERE is_real_product = TRUE AND identifiant_base = 'produits';

CREATE INDEX IF NOT EXISTS idx_autocomplete_relevance_sort 
ON autocomplete_characteristics(service_id, usage_count DESC) 
WHERE is_real_product = TRUE AND identifiant_base = 'produits';

CREATE INDEX IF NOT EXISTS idx_autocomplete_full_vector_gin_filtered 
ON autocomplete_characteristics USING GIN(full_vector) 
WHERE is_real_product = TRUE AND identifiant_base = 'produits';

CREATE INDEX IF NOT EXISTS idx_autocomplete_chosen_location_filtered 
ON autocomplete_characteristics(chosen_location) 
WHERE is_real_product = TRUE AND chosen_location IS NOT NULL;

-- Index conditionnels pour autocomplete_characteristics
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_autocomplete_user_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_autocomplete_user_id ON autocomplete_characteristics(user_id) WHERE user_id IS NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_autocomplete_service_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_autocomplete_service_id ON autocomplete_characteristics(service_id) WHERE service_id IS NOT NULL;
    END IF;
END $$;

-- Table autocomplete_combinations (nouveau 2025-11-02)
-- Stocke les vecteurs complets de produits pour recherche intelligente
CREATE TABLE IF NOT EXISTS autocomplete_combinations (
    id SERIAL PRIMARY KEY,
    service_id INTEGER,
    
    -- Vecteurs de VALEURS
    product_vector TEXT[] NOT NULL,        -- Ex: ["Nike", "Air Max", "Noir", "42"]
    location_vector TEXT[] DEFAULT '{}',   -- Ex: ["Douala", "Akwa", "Littoral", "Cameroun"]
    full_vector TEXT[] NOT NULL,           -- product_vector + location_vector
    
    -- Vecteurs d'étiquettes (labels) - nouveau pour traçabilité
    product_labels TEXT[] NOT NULL,        -- Ex: ["marque", "modele", "couleur", "pointure"]
    location_labels TEXT[] DEFAULT '{}',   -- DEPRECATED: Ne plus utiliser
    
    -- PAS de métadonnées de localisation (lieu UNIQUEMENT dans autocomplete_characteristics)
    
    -- Statistiques et IA
    usage_count INTEGER DEFAULT 1,
    is_ai_preferred BOOLEAN DEFAULT FALSE,
    ai_confidence FLOAT DEFAULT 0.0,
    session_id TEXT,
    
    -- Variabilité de prix
    has_variant BOOLEAN DEFAULT FALSE,
    variant_dimension TEXT,                 -- Ex: "pointure", "taille"
    variant_value TEXT,                     -- Ex: "42", "M"
    
    -- Prix et stock
    prix DECIMAL(12, 2),
    devise TEXT DEFAULT 'XAF',
    stock INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT unique_full_vector UNIQUE (full_vector),
    CONSTRAINT check_vectors_labels_length CHECK (array_length(product_vector, 1) = array_length(product_labels, 1))
);

-- Index pour autocomplete_combinations
CREATE INDEX IF NOT EXISTS idx_combinations_session ON autocomplete_combinations(session_id);
CREATE INDEX IF NOT EXISTS idx_combinations_usage_count ON autocomplete_combinations(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_combinations_variant ON autocomplete_combinations(has_variant, variant_dimension, variant_value);
CREATE INDEX IF NOT EXISTS idx_combinations_product_vector_gin ON autocomplete_combinations USING GIN(product_vector);
CREATE INDEX IF NOT EXISTS idx_combinations_full_vector_gin ON autocomplete_combinations USING GIN(full_vector);

-- Index conditionnels pour autocomplete_combinations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_combinations_service_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_combinations_service_id ON autocomplete_combinations(service_id) WHERE service_id IS NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_combinations_ai_preferred' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_combinations_ai_preferred ON autocomplete_combinations(is_ai_preferred) WHERE is_ai_preferred = TRUE;
    END IF;
END $$;


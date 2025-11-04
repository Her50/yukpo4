-- Active les extensions PostgreSQL nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Migration unifiée : création de toutes les tables et colonnes importantes pour Yukpo

-- Table users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    is_provider BOOLEAN NOT NULL DEFAULT FALSE,
    tokens_balance BIGINT NOT NULL DEFAULT 0,
    token_price_user DOUBLE PRECISION NOT NULL,
    token_price_provider DOUBLE PRECISION NOT NULL,
    commission_pct REAL NOT NULL,
    preferred_lang TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    gps VARCHAR(255),
    gps_consent BOOLEAN DEFAULT TRUE
);
ALTER TABLE users ALTER COLUMN gps_consent SET DEFAULT TRUE;

-- Table services
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    auto_deactivate_at TIMESTAMPTZ,
    last_reactivated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_tarissable BOOLEAN,
    vitesse_tarissement VARCHAR(255),
    active_days INTEGER,
    category VARCHAR(255),
    last_alert_sent_at TIMESTAMP
);

-- Table media
CREATE TABLE IF NOT EXISTS media (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    path TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    media_type TEXT,
    file_size BIGINT,
    file_format TEXT
);
-- Contrainte sur media_type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'media_type_check' AND table_name = 'media'
    ) THEN
        ALTER TABLE media ADD CONSTRAINT media_type_check CHECK (media_type IN ('image', 'video', 'audio'));
    END IF;
END $$;
-- Index sur service_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_media_service_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_media_service_id ON media (service_id);
    END IF;
END $$;

-- Table consultation_historique
CREATE TABLE IF NOT EXISTS consultation_historique (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table token_packs
CREATE TABLE IF NOT EXISTS token_packs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    tokens BIGINT NOT NULL
);

-- Table service_logs
CREATE TABLE IF NOT EXISTS service_logs (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT,
    reason TEXT,
    modification TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des transactions de paiement
CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
    payment_method JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    gateway_response JSONB,
    reference VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des transactions de tokens
CREATE TABLE IF NOT EXISTS token_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id VARCHAR(255) REFERENCES payment_transactions(transaction_id),
    amount INTEGER NOT NULL DEFAULT 0,
    bonus INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    transaction_type VARCHAR(50) NOT NULL, -- 'recharge', 'usage', 'refund'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes de paiement
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(transaction_type);

-- Table autocomplete_characteristics (✅ 2025-11-04 - Vectorielle)
-- Stocke les VRAIS produits validés par les prestataires (mode vectoriel)
-- Permet la recherche intelligente avec filtre lieu intégré
CREATE TABLE IF NOT EXISTS autocomplete_characteristics (
    id SERIAL PRIMARY KEY,
    identifiant_base VARCHAR(255) NOT NULL,
    
    -- ✅ MODE VECTORIEL (nouveaux champs 2025-11-04)
    characteristic_vector TEXT[] DEFAULT '{}',  -- Vecteur produit validé par prestataire
    location_vector TEXT[] DEFAULT '{}',        -- Vecteur lieu bidirectionnel (lieu choisi TOUJOURS en position 0)
    full_vector TEXT[] DEFAULT '{}',            -- characteristic_vector + location_vector
    product_id TEXT,                            -- Format: "serviceId_productIndex"
    chosen_location TEXT,                       -- Lieu choisi (position 0 du location_vector)
    chosen_location_geoname_id BIGINT,         -- ID GeoNames (GARANTIT unicité)
    is_real_product BOOLEAN DEFAULT TRUE,      -- TRUE = produit réel prestataire
    
    -- ✅ MODE INDIVIDUEL (ancien, conservé pour compatibilité)
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

-- Table autocomplete_combinations (✅ NOUVEAU 2025-11-02)
-- Stocke les vecteurs complets de produits pour recherche intelligente
CREATE TABLE IF NOT EXISTS autocomplete_combinations (
    id SERIAL PRIMARY KEY,
    service_id INTEGER,
    
    -- Vecteurs de VALEURS
    product_vector TEXT[] NOT NULL,        -- Ex: ["Nike", "Air Max", "Noir", "42"]
    location_vector TEXT[] DEFAULT '{}',   -- Ex: ["Douala", "Akwa", "Littoral", "Cameroun"]
    full_vector TEXT[] NOT NULL,           -- product_vector + location_vector
    
    -- Vecteurs d'ÉTIQUETTES (labels) - ✅ NOUVEAU pour traçabilité
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

-- Table products_lifecycle (gestion cycle de vie des produits)
CREATE TABLE IF NOT EXISTS products_lifecycle (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    product_nom TEXT NOT NULL,
    product_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    last_reactivated_at TIMESTAMPTZ,
    reactivation_cost INTEGER DEFAULT 1000,
    deactivation_count INTEGER DEFAULT 0,
    total_reactivation_paid INTEGER DEFAULT 0,
    UNIQUE(service_id, product_index)
);

-- Index pour products_lifecycle
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_id ON products_lifecycle(service_id);
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_active ON products_lifecycle(is_active);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_products_lifecycle_auto_deactivate' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_products_lifecycle_auto_deactivate ON products_lifecycle(auto_deactivate_at) WHERE is_active = TRUE;
    END IF;
END $$;

-- Table publicites (gestion des publicités)
CREATE TABLE IF NOT EXISTS publicites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    produits_indexes TEXT[] NOT NULL DEFAULT '{}',
    videos TEXT[] DEFAULT '{}',
    thumbnails TEXT[] DEFAULT '{}',
    duree_jours INTEGER NOT NULL CHECK (duree_jours > 0),
    cout INTEGER NOT NULL CHECK (cout >= 0),
    devise_utilisateur VARCHAR(10) DEFAULT 'FCFA',
    zone_geographique VARCHAR(50) NOT NULL DEFAULT 'local' CHECK (zone_geographique IN ('local', 'regional', 'international')),
    geo_publicitaire GEOMETRY(POINT, 4326),
    rayon_km INTEGER DEFAULT 50,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'paused')),
    date_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_fin TIMESTAMPTZ NOT NULL,
    vues INTEGER NOT NULL DEFAULT 0,
    clics INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_date_fin_after_debut CHECK (date_fin > date_debut),
    CONSTRAINT check_produits_not_empty CHECK (array_length(produits_indexes, 1) > 0)
);

-- Index pour publicites
CREATE INDEX IF NOT EXISTS idx_publicites_user_id ON publicites(user_id);
CREATE INDEX IF NOT EXISTS idx_publicites_status ON publicites(status);
CREATE INDEX IF NOT EXISTS idx_publicites_zone ON publicites(zone_geographique);
CREATE INDEX IF NOT EXISTS idx_publicites_date_fin ON publicites(date_fin);
CREATE INDEX IF NOT EXISTS idx_publicites_produits_gin ON publicites USING GIN(produits_indexes);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_publicites_active' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_publicites_active ON publicites(status, date_fin) WHERE status = 'active';
    END IF;
END $$;

-- Table notifications (gestion des notifications utilisateurs)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50),
    notification_type VARCHAR(50),
    title VARCHAR(255),
    message TEXT NOT NULL,
    data JSONB,
    metadata JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ
);

-- Index pour notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_notifications_user_unread' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_notifications_type' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_notifications_type ON notifications(type) WHERE type IS NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_notifications_notification_type' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_notifications_notification_type ON notifications(notification_type) WHERE notification_type IS NOT NULL;
    END IF;
END $$;

-- ========================================
-- FONCTIONS ET TRIGGERS SQL
-- ========================================

-- Fonction : Désactiver les produits expirés automatiquement
CREATE OR REPLACE FUNCTION deactivate_expired_products()
RETURNS TABLE(
    service_id INTEGER,
    product_index INTEGER,
    product_nom TEXT,
    user_id INTEGER
) AS $$
BEGIN
    RETURN QUERY
    UPDATE products_lifecycle pl
    SET 
        is_active = FALSE,
        updated_at = NOW(),
        deactivation_count = deactivation_count + 1
    FROM services s
    WHERE pl.service_id = s.id
        AND pl.is_active = TRUE
        AND pl.auto_deactivate_at <= NOW()
    RETURNING 
        pl.service_id,
        pl.product_index,
        pl.product_nom,
        s.user_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction : Mettre à jour updated_at pour publicites
CREATE OR REPLACE FUNCTION update_publicites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger : Appliquer update_publicites_updated_at
DROP TRIGGER IF EXISTS trigger_update_publicites_updated_at ON publicites;
CREATE TRIGGER trigger_update_publicites_updated_at
    BEFORE UPDATE ON publicites
    FOR EACH ROW
    EXECUTE FUNCTION update_publicites_updated_at();

-- Fonction : Calculer automatiquement date_fin pour publicites
CREATE OR REPLACE FUNCTION set_publicite_date_fin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date_fin IS NULL OR NEW.date_fin = NEW.date_debut THEN
        NEW.date_fin = NEW.date_debut + (NEW.duree_jours || ' days')::interval;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger : Appliquer set_publicite_date_fin
DROP TRIGGER IF EXISTS trigger_set_publicite_date_fin ON publicites;
CREATE TRIGGER trigger_set_publicite_date_fin
    BEFORE INSERT OR UPDATE ON publicites
    FOR EACH ROW
    EXECUTE FUNCTION set_publicite_date_fin();

-- Fonction : Désactiver les publicités expirées
CREATE OR REPLACE FUNCTION deactivate_expired_publicites()
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    UPDATE publicites
    SET status = 'expired'
    WHERE status = 'active'
    AND date_fin < NOW();
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

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
BEGIN
    IF search_location IS NULL OR location_vector IS NULL THEN
        RETURN 0.0;
    END IF;
    
    search_lower := LOWER(search_location);
    
    IF chosen_location IS NOT NULL AND LOWER(chosen_location) = search_lower THEN
        RETURN 1.0;
    END IF;
    
    FOR i IN 1..array_length(location_vector, 1) LOOP
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
BEGIN
    IF p_vector IS NULL OR p_labels IS NULL OR p_search_label IS NULL THEN
        RETURN NULL;
    END IF;
    
    IF array_length(p_vector, 1) != array_length(p_labels, 1) THEN
        RETURN NULL;
    END IF;
    
    FOR i IN 1..array_length(p_labels, 1) LOOP
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
BEGIN
    IF p_vector IS NULL OR p_labels IS NULL THEN
        RETURN result;
    END IF;
    
    IF array_length(p_vector, 1) != array_length(p_labels, 1) THEN
        RETURN result;
    END IF;
    
    FOR i IN 1..array_length(p_labels, 1) LOOP
        result := result || jsonb_build_object(p_labels[i], p_vector[i]);
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

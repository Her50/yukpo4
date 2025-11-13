-- Active les extensions PostgreSQL nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS postgis;

-- Migration unifiée : création de toutes les tables et colonnes importantes pour Yukpo

-- Table users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    nom VARCHAR(255),
    prenom VARCHAR(255),
    nom_complet VARCHAR(255),
    photo_profil VARCHAR(500),
    avatar_url VARCHAR(500),
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
    product_id TEXT,
    product_index INTEGER,
    type TEXT NOT NULL,
    path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    media_type TEXT,
    file_size BIGINT,
    file_format TEXT,
    is_main_image BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    ai_description TEXT,
    ai_tags TEXT[],
    ai_category VARCHAR(100),
    ai_metadata JSONB,
    ai_analyzed_at TIMESTAMPTZ,
    ai_model_used VARCHAR(100),
    ai_confidence DOUBLE PRECISION
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

CREATE INDEX IF NOT EXISTS idx_media_product_id ON media (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_product_index ON media (product_index) WHERE product_index IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_service_product ON media (service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_media_main_image ON media (product_id, is_main_image) WHERE is_main_image = TRUE;
CREATE INDEX IF NOT EXISTS idx_media_product_display ON media (product_id, display_order) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_ai_description_fulltext
    ON media USING GIN (to_tsvector('french', COALESCE(ai_description, '')));
CREATE INDEX IF NOT EXISTS idx_media_ai_tags_gin ON media USING GIN (ai_tags);
CREATE INDEX IF NOT EXISTS idx_media_ai_category ON media(ai_category) WHERE ai_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_ai_metadata_gin ON media USING GIN (ai_metadata);

COMMENT ON COLUMN media.product_id IS 'ID du produit spécifique auquel ce média appartient';
COMMENT ON COLUMN media.product_index IS 'Index du produit dans service.data.produits[] (0-based)';
COMMENT ON COLUMN media.is_main_image IS 'Indique si ce média est l''image principale du produit';
COMMENT ON COLUMN media.display_order IS 'Ordre d''affichage du média pour un produit';
COMMENT ON COLUMN media.ai_description IS 'Description générée par IA pour recherche full-text';
COMMENT ON COLUMN media.ai_tags IS 'Tags IA utilisés pour le matching';
COMMENT ON COLUMN media.ai_category IS 'Catégorie détectée automatiquement';
COMMENT ON COLUMN media.ai_metadata IS 'Métadonnées IA (marque, couleurs, caractéristiques...)';
COMMENT ON COLUMN media.ai_analyzed_at IS 'Date de la dernière analyse IA';
COMMENT ON COLUMN media.ai_model_used IS 'Modèle IA utilisé';
COMMENT ON COLUMN media.ai_confidence IS 'Score de confiance de l''analyse IA';

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

-- Table service_reviews (avis/commentaires avec support réponses - 2025-11-04)
-- Permet à TOUS les utilisateurs de noter et commenter les produits/services
-- Supporte les réponses aux commentaires avec indexation claire
CREATE TABLE IF NOT EXISTS service_reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 0 AND rating <= 5) NOT NULL,
    comment TEXT,
    reply_to_review_id INTEGER REFERENCES service_reviews(id) ON DELETE CASCADE,
    is_helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour service_reviews
CREATE INDEX IF NOT EXISTS idx_service_reviews_user_id ON service_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_service_reviews_service_id ON service_reviews(service_id);
CREATE INDEX IF NOT EXISTS idx_service_reviews_rating ON service_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_service_reviews_created_at ON service_reviews(created_at);

-- Index pour les réponses (SQLx offline mode compatible)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_service_reviews_reply_to'
    ) THEN
        CREATE INDEX idx_service_reviews_reply_to ON service_reviews(reply_to_review_id) WHERE reply_to_review_id IS NOT NULL;
    END IF;
END $$;

-- Table product_reactions (réactions/émotions sur les produits - 2025-11-04)
-- Permet aux utilisateurs de réagir avec des émotions sur les produits
CREATE TABLE IF NOT EXISTS product_reactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,  -- Format: "serviceId_productIndex"
    reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN (
        'love',        -- adore
        'like',        -- aime
        'wow',         -- impressionnant
        'interested',  -- interessant
        'thinking',    -- a reflechir
        'disappointed' -- decu
    )),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, service_id, product_id, reaction_type)
);

-- Index pour product_reactions (SQLx offline mode compatible)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_product_reactions_product'
    ) THEN
        CREATE INDEX idx_product_reactions_product ON product_reactions(service_id, product_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_product_reactions_user'
    ) THEN
        CREATE INDEX idx_product_reactions_user ON product_reactions(user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_product_reactions_type'
    ) THEN
        CREATE INDEX idx_product_reactions_type ON product_reactions(reaction_type);
    END IF;
END $$;

-- Table product_comments (fil de discussion moderne - 2025-11-08)
CREATE TABLE IF NOT EXISTS product_comments (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id INTEGER REFERENCES product_comments(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating BETWEEN 0 AND 5),
    content TEXT NOT NULL,
    mentions INTEGER[] NOT NULL DEFAULT '{}',
    reaction_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_product_comments_service ON product_comments(service_id);
CREATE INDEX IF NOT EXISTS idx_product_comments_parent ON product_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_product_comments_user ON product_comments(user_id);

CREATE OR REPLACE FUNCTION set_product_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_product_comments_updated_at ON product_comments;
CREATE TRIGGER trigger_product_comments_updated_at
    BEFORE UPDATE ON product_comments
    FOR EACH ROW
    EXECUTE FUNCTION set_product_comments_updated_at();

CREATE TABLE IF NOT EXISTS product_comment_reactions (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES product_comments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN (
        'like',
        'love',
        'insightful',
        'support',
        'funny',
        'angry'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(comment_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_product_comment_reactions_comment ON product_comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_product_comment_reactions_user ON product_comment_reactions(user_id);

CREATE OR REPLACE VIEW product_comments_view AS
SELECT
    pc.id,
    pc.service_id,
    pc.user_id,
    pc.parent_comment_id,
    pc.rating,
    pc.content,
    pc.mentions,
    pc.reaction_counts,
    pc.created_at,
    pc.updated_at,
    pc.edited_at,
    pc.is_deleted,
    COALESCE(u.nom_complet, u.email) AS user_name,
    u.avatar_url AS user_avatar,
    (
        SELECT jsonb_object_agg(reaction_type, reaction_count)
        FROM (
            SELECT reaction_type, COUNT(*)::INT AS reaction_count
            FROM product_comment_reactions
            WHERE comment_id = pc.id
            GROUP BY reaction_type
        ) sub
    ) AS aggregated_reactions,
    (
        SELECT COUNT(*)::INT
        FROM product_comments replies
        WHERE replies.parent_comment_id = pc.id
          AND replies.is_deleted = FALSE
    ) AS reply_count
FROM product_comments pc
JOIN users u ON u.id = pc.user_id;

COMMENT ON VIEW product_comments_view IS 'Commentaires produits enrichis avec auteur, réactions agrégées et nombre de réponses';

-- Table private_conversations (conversations privées 1-to-1 - 2025-11-04)
CREATE TABLE IF NOT EXISTS private_conversations (
    id SERIAL PRIMARY KEY,
    user_1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_1_id, user_2_id),
    CONSTRAINT chk_users_order CHECK (user_1_id < user_2_id)
);

-- Index pour private_conversations (SQLx offline mode compatible)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_private_conversations_user_1'
    ) THEN
        CREATE INDEX idx_private_conversations_user_1 ON private_conversations(user_1_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_private_conversations_user_2'
    ) THEN
        CREATE INDEX idx_private_conversations_user_2 ON private_conversations(user_2_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_private_conversations_last_message'
    ) THEN
        CREATE INDEX idx_private_conversations_last_message ON private_conversations(last_message_at DESC);
    END IF;
END $$;

-- Fonction pour obtenir le décompte des réactions par produit
CREATE OR REPLACE FUNCTION get_product_reactions_count(
    p_service_id INTEGER,
    p_product_id TEXT
)
RETURNS TABLE (
    reaction_type VARCHAR(20),
    count BIGINT,
    users_sample TEXT[]
)
LANGUAGE SQL
AS $$
    SELECT 
        pr.reaction_type,
        COUNT(*)::BIGINT as count,
        array_agg(COALESCE(u.nom_complet, u.email) ORDER BY pr.created_at DESC)::TEXT[] as users_sample
    FROM product_reactions pr
    LEFT JOIN users u ON pr.user_id = u.id
    WHERE pr.service_id = p_service_id
      AND pr.product_id = p_product_id
    GROUP BY pr.reaction_type
    ORDER BY count DESC;
$$;

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

-- Tables live streaming (2025-11-09)
CREATE TABLE IF NOT EXISTS live_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    livekit_room_name TEXT,
    livekit_participant_identity TEXT,
    livekit_ingress_id TEXT,
    livekit_ingress_url TEXT,
    stream_key TEXT,
    webrtc_url TEXT,
    hls_url TEXT,
    fallback_rtmp_url TEXT,
    fallback_hls_url TEXT,
    current_viewers INTEGER NOT NULL DEFAULT 0,
    peak_viewers INTEGER NOT NULL DEFAULT 0,
    total_watch_time_seconds BIGINT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_start_at ON live_sessions(start_at);
CREATE INDEX IF NOT EXISTS idx_live_sessions_service_id ON live_sessions(service_id);

CREATE TABLE IF NOT EXISTS live_replays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    replay_url TEXT NOT NULL,
    storage_provider TEXT,
    format TEXT,
    duration_seconds INTEGER,
    size_bytes BIGINT,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_replays_session_id ON live_replays(live_session_id);

CREATE TABLE IF NOT EXISTS live_session_analytics (
    live_session_id UUID PRIMARY KEY REFERENCES live_sessions(id) ON DELETE CASCADE,
    total_viewers INTEGER NOT NULL DEFAULT 0,
    hls_viewers INTEGER NOT NULL DEFAULT 0,
    webrtc_viewers INTEGER NOT NULL DEFAULT 0,
    total_watch_time_seconds BIGINT NOT NULL DEFAULT 0,
    average_watch_time_seconds NUMERIC(10,2) NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,
    revenue_cfa NUMERIC(14,2) NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_session_analytics_last_synced ON live_session_analytics(last_synced_at);

CREATE TABLE IF NOT EXISTS live_flash_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    promo_price_cfa NUMERIC(14,2) NOT NULL CHECK (promo_price_cfa >= 0),
    stock_target INTEGER NOT NULL CHECK (stock_target > 0),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled' CHECK (
        status IN ('scheduled', 'live', 'ended', 'cancelled')
    ),
    commentary_mode VARCHAR(20) NOT NULL DEFAULT 'host' CHECK (
        commentary_mode IN ('host', 'ai_voice')
    ),
    commentary_interval_seconds INTEGER NOT NULL DEFAULT 60 CHECK (commentary_interval_seconds >= 15),
    ai_voice_profile TEXT,
    scheduled_notification_sent_at TIMESTAMPTZ,
    live_notification_sent_at TIMESTAMPTZ,
    ending_notification_sent_at TIMESTAMPTZ,
    last_commentary_sent_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_live_flash_sales_session
    ON live_flash_sales(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status
    ON live_flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_timing
    ON live_flash_sales(start_at, end_at);

CREATE TABLE IF NOT EXISTS live_flash_sale_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flash_sale_id UUID NOT NULL REFERENCES live_flash_sales(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (flash_sale_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_flash_sale_reservations_flash
    ON live_flash_sale_reservations(flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_live_flash_sale_reservations_user
    ON live_flash_sale_reservations(user_id);

CREATE TABLE IF NOT EXISTS live_flash_sale_commentaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flash_sale_id UUID NOT NULL REFERENCES live_flash_sales(id) ON DELETE CASCADE,
    created_by VARCHAR(20) NOT NULL CHECK (created_by IN ('host', 'ai_voice')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_flash_sale_commentaries_flash
    ON live_flash_sale_commentaries(flash_sale_id, created_at);

-- Social connectors tables
CREATE TABLE IF NOT EXISTS social_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    account_handle TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    scope TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

CREATE TABLE IF NOT EXISTS social_publications (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    external_post_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    published_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_publication_jobs (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    attempt INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user_platform ON social_accounts(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_social_publications_media ON social_publications(media_id);
CREATE INDEX IF NOT EXISTS idx_social_publications_platform ON social_publications(platform);
CREATE INDEX IF NOT EXISTS idx_social_publication_jobs_status ON social_publication_jobs(status, scheduled_for);

-- Table media_engagement
CREATE TABLE IF NOT EXISTS media_engagement (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    channel TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    metadata JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_engagement_media ON media_engagement(media_id);
CREATE INDEX IF NOT EXISTS idx_media_engagement_event ON media_engagement(event_type);
CREATE INDEX IF NOT EXISTS idx_media_engagement_service ON media_engagement(service_id);

-- Table media_distribution
CREATE TABLE IF NOT EXISTS media_distribution (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    target TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_media_distribution_media ON media_distribution(media_id);
CREATE INDEX IF NOT EXISTS idx_media_distribution_target ON media_distribution(target);

-- Table content_engagement
CREATE TABLE IF NOT EXISTS content_engagement (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL,
    liked BOOLEAN NOT NULL DEFAULT FALSE,
    saved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, content_id)
);
CREATE INDEX IF NOT EXISTS idx_content_engagement_user ON content_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_content_engagement_content ON content_engagement(content_id);

CREATE OR REPLACE FUNCTION set_content_engagement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_engagement_updated_at ON content_engagement;
CREATE TRIGGER trg_content_engagement_updated_at
    BEFORE UPDATE ON content_engagement
    FOR EACH ROW
    EXECUTE FUNCTION set_content_engagement_updated_at();

CREATE TABLE IF NOT EXISTS video_generation_jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    product_index INTEGER,
    status TEXT NOT NULL DEFAULT 'queued',
    progress_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    result_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    result_payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_user ON video_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_service ON video_generation_jobs(service_id);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status ON video_generation_jobs(status);

-- Delivery service enums
DO $$
BEGIN
    CREATE TYPE delivery_status AS ENUM (
        'requested',
        'awaiting_courier_confirmation',
        'accepted',
        'en_route_pickup',
        'arrival_pickup',
        'picked_up',
        'shopping_in_progress',
        'shopping_completed',
        'en_route_delivery',
        'arrival_destination',
        'delivered',
        'completed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_cancel_reason AS ENUM (
        'client_cancelled',
        'courier_cancelled',
        'no_courier_available',
        'parcel_issue',
        'system_failure'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_engine_type AS ENUM (
        'moto',
        'scooter',
        'voiture',
        'camionnette',
        'velo_cargo',
        'pieton',
        'camion_leger',
        'autre'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_courier_status AS ENUM (
        'pending_review',
        'approved',
        'rejected',
        'suspended'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_terrain_difficulty AS ENUM (
        'smooth',
        'moderate',
        'rough',
        'blocked'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_application_status AS ENUM (
        'draft',
        'submitted',
        'under_review',
        'approved',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE shopping_status AS ENUM (
        'pending',
        'awaiting_purchase',
        'shopping_in_progress',
        'shopping_completed',
        'checkout_submitted',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE shopping_item_status AS ENUM (
        'pending',
        'purchased',
        'missing',
        'replaced'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- Parcel types catalogue
CREATE TABLE IF NOT EXISTS parcel_types (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    max_weight_kg NUMERIC(6,2),
    max_volume_cm3 NUMERIC(12,2),
    requires_isothermal BOOLEAN DEFAULT FALSE,
    requires_fragile_handling BOOLEAN DEFAULT FALSE,
    requires_secure_box BOOLEAN DEFAULT FALSE,
    requires_document_protection BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parcel_types_slug ON parcel_types(slug);

-- Courier onboarding
CREATE TABLE IF NOT EXISTS courier_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status delivery_application_status NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewer_id INTEGER REFERENCES users(id),
    rejection_reason TEXT,
    profile_data JSONB DEFAULT '{}'::jsonb,
    documents JSONB DEFAULT '[]'::jsonb,
    notes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_applications_user ON courier_applications(user_id);

CREATE TABLE IF NOT EXISTS couriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id UUID UNIQUE REFERENCES courier_applications(id) ON DELETE SET NULL,
    status delivery_courier_status NOT NULL DEFAULT 'pending_review',
    rating_average NUMERIC(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    bio TEXT,
    hired_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courier_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    engine_type delivery_engine_type NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    max_weight_kg NUMERIC(6,2),
    max_volume_cm3 NUMERIC(12,2),
    equipments JSONB DEFAULT '[]'::jsonb,
    available BOOLEAN DEFAULT TRUE,
    availability_schedule JSONB,
    documents JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_assets_courier ON courier_assets(courier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_assets_primary ON courier_assets(courier_id) WHERE is_primary = TRUE;

-- Delivery core tables
CREATE TABLE IF NOT EXISTS delivery_parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_id INTEGER REFERENCES parcel_types(id) ON DELETE SET NULL,
    weight_kg NUMERIC(6,2),
    volume_cm3 NUMERIC(12,2),
    declared_value NUMERIC(10,2),
    notes TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    constraints JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL,
    parcel_id UUID NOT NULL REFERENCES delivery_parcels(id) ON DELETE CASCADE,
    status delivery_status NOT NULL DEFAULT 'requested',
    requested_at TIMESTAMPTZ DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_reason delivery_cancel_reason,
    pickup_location GEOGRAPHY(Point, 4326) NOT NULL,
    dropoff_location GEOGRAPHY(Point, 4326) NOT NULL,
    pickup_address TEXT,
    dropoff_address TEXT,
    recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    recipient_contact_name TEXT,
    recipient_contact_phone TEXT,
    recipient_notes TEXT,
    recipient_tracking_token UUID UNIQUE DEFAULT gen_random_uuid(),
    recipient_dropoff_override GEOGRAPHY(Point, 4326),
    recipient_dropoff_address TEXT,
    recipient_dropoff_updated_at TIMESTAMPTZ,
    recipient_chat_thread_id UUID,
    distance_meters INTEGER,
    estimated_duration_seconds INTEGER,
    actual_duration_seconds INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now(),
    pricing_id UUID,
    tracking_token UUID UNIQUE DEFAULT gen_random_uuid(),
    metadata JSONB DEFAULT '{}'::jsonb,
    shopping_required BOOLEAN DEFAULT FALSE,
    store_location GEOGRAPHY(Point, 4326),
    store_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_deliveries_status_requested_at ON deliveries(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries(courier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_creator ON deliveries(creator_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_user ON deliveries(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_tracking_token ON deliveries(recipient_tracking_token);
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_location ON deliveries USING GIST(pickup_location);
CREATE INDEX IF NOT EXISTS idx_deliveries_dropoff_location ON deliveries USING GIST(dropoff_location);

CREATE TABLE IF NOT EXISTS delivery_status_events (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    status delivery_status NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload JSONB DEFAULT '{}'::jsonb,
    recorded_by INTEGER
);

CREATE INDEX IF NOT EXISTS idx_delivery_status_events_delivery ON delivery_status_events(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status_events_delivery_time ON delivery_status_events(delivery_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS delivery_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    base_price_cents INTEGER NOT NULL,
    distance_price_cents INTEGER NOT NULL,
    surcharge_cents INTEGER DEFAULT 0,
    discount_cents INTEGER DEFAULT 0,
    currency CHAR(3) DEFAULT 'XAF',
    calculated_at TIMESTAMPTZ DEFAULT now(),
    details JSONB DEFAULT '{}'::jsonb,
    shopping_cost_cents INTEGER DEFAULT 0,
    shopping_discount_cents INTEGER DEFAULT 0
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_deliveries_pricing'
          AND table_name = 'deliveries'
          AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE deliveries
            ADD CONSTRAINT fk_deliveries_pricing
            FOREIGN KEY (pricing_id)
            REFERENCES delivery_pricing(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS delivery_tracking_points (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    location GEOGRAPHY(Point, 4326) NOT NULL,
    speed_kmh NUMERIC(5,2),
    bearing NUMERIC(6,2),
    accuracy_meters NUMERIC(6,2)
);

CREATE INDEX IF NOT EXISTS idx_tracking_points_delivery ON delivery_tracking_points(delivery_id);
CREATE INDEX IF NOT EXISTS idx_tracking_points_courier ON delivery_tracking_points(courier_id);
CREATE INDEX IF NOT EXISTS idx_tracking_points_captured_at ON delivery_tracking_points(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_points_location ON delivery_tracking_points USING GIST(location);

CREATE TABLE IF NOT EXISTS delivery_recipient_updates (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    submitted_by INTEGER REFERENCES users(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_recipient_updates_delivery ON delivery_recipient_updates(delivery_id, created_at DESC);

CREATE TABLE IF NOT EXISTS courier_ratings (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    rater_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score_small INTEGER NOT NULL CHECK (score_small BETWEEN 1 AND 5),
    tags TEXT[],
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_ratings_courier ON courier_ratings(courier_id);

CREATE TABLE IF NOT EXISTS client_ratings (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    score_small INTEGER NOT NULL CHECK (score_small BETWEEN 1 AND 5),
    tags TEXT[],
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_ratings_client ON client_ratings(client_id);

CREATE TABLE IF NOT EXISTS traffic_snapshots (
    id BIGSERIAL PRIMARY KEY,
    captured_at TIMESTAMPTZ NOT NULL,
    source TEXT,
    bounding_box GEOGRAPHY(Polygon, 4326),
    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_captured_at ON traffic_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_source ON traffic_snapshots(source);

CREATE TABLE IF NOT EXISTS terrain_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment GEOGRAPHY(LineString, 4326) NOT NULL,
    difficulty delivery_terrain_difficulty NOT NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terrain_segments_difficulty ON terrain_segments(difficulty);
CREATE INDEX IF NOT EXISTS idx_terrain_segments_segment ON terrain_segments USING GIST(segment);

CREATE TABLE IF NOT EXISTS shopping_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    status shopping_status NOT NULL DEFAULT 'pending',
    estimated_total_cents INTEGER NOT NULL DEFAULT 0,
    actual_total_cents INTEGER,
    currency CHAR(3) DEFAULT 'XAF',
    store_name TEXT,
    store_location GEOGRAPHY(Point, 4326),
    notes TEXT,
    requires_balance_top_up BOOLEAN DEFAULT FALSE,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_orders_status ON shopping_orders(status);

CREATE TABLE IF NOT EXISTS shopping_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopping_order_id UUID NOT NULL REFERENCES shopping_orders(id) ON DELETE CASCADE,
    product_id UUID,
    product_name TEXT NOT NULL,
    characteristics JSONB DEFAULT '[]'::jsonb,
    quantity NUMERIC(10,2) NOT NULL,
    unit TEXT DEFAULT 'unite',
    estimated_price_cents INTEGER DEFAULT 0,
    actual_price_cents INTEGER,
    status shopping_item_status NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_order_items_order ON shopping_order_items(shopping_order_id);
CREATE INDEX IF NOT EXISTS idx_shopping_order_items_status ON shopping_order_items(status);

CREATE TABLE IF NOT EXISTS delivery_wallet_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('debit', 'refund')),
    amount_cents BIGINT NOT NULL,
    reason TEXT,
    balance_after BIGINT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_wallet_events_user ON delivery_wallet_events(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_wallet_events_delivery ON delivery_wallet_events(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_wallet_events_created_at ON delivery_wallet_events(created_at DESC);

CREATE TABLE IF NOT EXISTS video_weekly_reports (
    id SERIAL PRIMARY KEY,
    week_start TIMESTAMPTZ NOT NULL,
    week_end TIMESTAMPTZ NOT NULL,
    total_videos BIGINT NOT NULL,
    total_views BIGINT NOT NULL,
    average_quality DOUBLE PRECISION NOT NULL,
    top_services JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_video_weekly_reports_week ON video_weekly_reports(week_start, week_end);

-- Seed default parcel types
INSERT INTO parcel_types (slug, display_name, description, max_weight_kg, max_volume_cm3, requires_fragile_handling, requires_isothermal, requires_secure_box, requires_document_protection)
VALUES
    ('standard', 'Colis standard', 'Poids et dimensions classiques', 30, 60000, FALSE, FALSE, FALSE, FALSE),
    ('fragile', 'Fragile', 'Verre, électronique, nécessite manutention douce', 20, 40000, TRUE, FALSE, TRUE, FALSE),
    ('volumineux', 'Volumineux', 'Mobilier ou charges encombrantes', 80, 250000, FALSE, FALSE, FALSE, FALSE),
    ('medical', 'Médical', 'Colis médicaux sensibles', 10, 20000, TRUE, TRUE, TRUE, FALSE),
    ('document', 'Document', 'Documents importants/confidentiels', 5, 5000, TRUE, FALSE, TRUE, TRUE)
ON CONFLICT (slug) DO NOTHING;

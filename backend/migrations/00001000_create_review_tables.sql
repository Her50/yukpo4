-- Tables pour les avis, commentaires et réactions

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

-- ✅ CORRECTION 2026-01-30: DROP la vue avant de la recréer pour éviter l'erreur "cannot change data type"
DROP VIEW IF EXISTS product_comments_view CASCADE;

CREATE VIEW product_comments_view AS
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
    COALESCE(u.nom_complet::TEXT, u.email) AS user_name,
    u.avatar_url AS user_avatar,
    (
        SELECT jsonb_object_agg(reaction_type, reaction_count)
        FROM (
            SELECT reaction_type, COUNT(*)::INTEGER AS reaction_count
            FROM product_comment_reactions
            WHERE comment_id = pc.id
            GROUP BY reaction_type
        ) AS reactions
    ) AS reactions_summary
FROM product_comments pc
LEFT JOIN users u ON u.id = pc.user_id
WHERE pc.is_deleted = FALSE;






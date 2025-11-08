-- ✅ Migration 2025-11-08 : Système complet de commentaires produits (fil Facebook)

-- Table principale des commentaires
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

-- Fonction de mise à jour de la colonne updated_at
CREATE OR REPLACE FUNCTION set_product_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger mise à jour updated_at
CREATE TRIGGER trigger_product_comments_updated_at
    BEFORE UPDATE ON product_comments
    FOR EACH ROW
    EXECUTE FUNCTION set_product_comments_updated_at();

-- Table des réactions sur commentaires
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

-- Vue pour récupérer les commentaires avec leurs métadonnées consolidées
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
    u.nom_complet AS user_name,
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



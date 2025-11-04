-- Migration pour ajouter le support des réponses aux avis/commentaires sur les produits
-- Permet aux utilisateurs de répondre à un avis spécifique avec indexation claire

-- Ajouter la colonne reply_to_review_id à la table service_reviews
ALTER TABLE service_reviews
ADD COLUMN IF NOT EXISTS reply_to_review_id INTEGER REFERENCES service_reviews(id) ON DELETE CASCADE;

-- Ajouter un commentaire explicatif
COMMENT ON COLUMN service_reviews.reply_to_review_id IS 'ID de l''avis auquel on répond (système de réponses aux commentaires)';

-- ✅ SQLx OFFLINE MODE: Créer l'index de manière conditionnelle
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_service_reviews_reply_to'
    ) THEN
        CREATE INDEX idx_service_reviews_reply_to ON service_reviews(reply_to_review_id) WHERE reply_to_review_id IS NOT NULL;
    END IF;
END $$;

-- Créer une vue pour faciliter la récupération des avis avec leurs réponses
CREATE OR REPLACE VIEW service_reviews_with_replies AS
SELECT 
    r.*,
    u.name as user_name,
    u.email as user_email,
    u.avatar_url as user_avatar,
    rr.id as reply_to_id,
    rr.user_id as reply_to_user_id,
    rr.rating as reply_to_rating,
    rr.comment as reply_to_text,
    rr.created_at as reply_to_created_at,
    ru.name as reply_to_user_name,
    ru.avatar_url as reply_to_user_avatar
FROM service_reviews r
LEFT JOIN users u ON r.user_id = u.id
LEFT JOIN service_reviews rr ON r.reply_to_review_id = rr.id
LEFT JOIN users ru ON rr.user_id = ru.id;

COMMENT ON VIEW service_reviews_with_replies IS 'Vue combinant les avis avec leurs réponses pour faciliter les requêtes';

-- Fonction pour obtenir les avis d'un service avec leurs réponses
CREATE OR REPLACE FUNCTION get_service_reviews_with_replies(
    p_service_id INTEGER,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    review_id INTEGER,
    user_id INTEGER,
    user_name TEXT,
    user_avatar TEXT,
    rating INTEGER,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    reply_to_review_id INTEGER,
    reply_to_user_name TEXT,
    reply_to_text TEXT,
    reply_to_created_at TIMESTAMP WITH TIME ZONE,
    reply_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id::INTEGER as review_id,
        r.user_id::INTEGER,
        u.name::TEXT as user_name,
        u.avatar_url::TEXT as user_avatar,
        r.rating::INTEGER,
        r.comment::TEXT,
        r.created_at,
        r.updated_at,
        r.reply_to_review_id::INTEGER,
        ru.name::TEXT as reply_to_user_name,
        rr.comment::TEXT as reply_to_text,
        rr.created_at as reply_to_created_at,
        (SELECT COUNT(*) FROM service_reviews WHERE reply_to_review_id = r.id)::BIGINT as reply_count
    FROM service_reviews r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN service_reviews rr ON r.reply_to_review_id = rr.id
    LEFT JOIN users ru ON rr.user_id = ru.id
    WHERE r.service_id = p_service_id
    ORDER BY r.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_service_reviews_with_replies IS 'Récupère les avis d''un service avec leurs réponses et le nombre de réponses par avis';

-- Fonction pour obtenir les réponses d'un avis spécifique
CREATE OR REPLACE FUNCTION get_review_replies(
    p_review_id INTEGER,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    reply_id INTEGER,
    user_id INTEGER,
    user_name TEXT,
    user_avatar TEXT,
    rating INTEGER,
    reply_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id::INTEGER as reply_id,
        r.user_id::INTEGER,
        u.name::TEXT as user_name,
        u.avatar_url::TEXT as user_avatar,
        r.rating::INTEGER,
        r.comment::TEXT as reply_text,
        r.created_at
    FROM service_reviews r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.reply_to_review_id = p_review_id
    ORDER BY r.created_at ASC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_review_replies IS 'Récupère toutes les réponses à un avis spécifique';


-- Migration pour le système de réactions/émotions sur les produits
-- Date: 2025-11-04
-- Description: Permet aux utilisateurs de réagir avec des émotions sur les produits

-- Table pour les réactions sur les produits
CREATE TABLE IF NOT EXISTS product_reactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,  -- Format: "serviceId_productIndex"
    reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN (
        'love',        -- ❤️ J'adore
        'like',        -- 👍 J'aime
        'wow',         -- 😮 Impressionnant
        'interested',  -- 🎯 Intéressant
        'thinking',    -- 🤔 À réfléchir
        'disappointed' -- 😕 Déçu
    )),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, service_id, product_id, reaction_type)
);

-- ✅ SQLx OFFLINE MODE: Créer les index de manière conditionnelle
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

COMMENT ON TABLE product_reactions IS 'Réactions/émotions des utilisateurs sur les produits';
COMMENT ON FUNCTION get_product_reactions_count IS 'Récupère le décompte des réactions par produit avec échantillon d\'utilisateurs';

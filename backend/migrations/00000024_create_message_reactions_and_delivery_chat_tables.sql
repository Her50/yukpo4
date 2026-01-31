-- Tables pour réactions messages et chat de livraison

-- ✅ 2025-01-27 : Table message_reactions (réactions aux messages de chat)
CREATE TABLE IF NOT EXISTS message_reactions (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contrainte unique: un utilisateur ne peut réagir qu'une fois avec le même emoji sur un message
    UNIQUE(message_id, user_id, emoji)
);

-- Index pour recherche rapide (PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_message_reactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_update_message_reactions_updated_at ON message_reactions;
CREATE TRIGGER trigger_update_message_reactions_updated_at
    BEFORE UPDATE ON message_reactions
    FOR EACH ROW
    EXECUTE FUNCTION update_message_reactions_updated_at();

-- Commentaires
COMMENT ON TABLE message_reactions IS 'Réactions (emojis) aux messages de chat';
COMMENT ON COLUMN message_reactions.message_id IS 'ID du message (format: msg_xxx ou UUID)';
COMMENT ON COLUMN message_reactions.user_id IS 'ID de l''utilisateur qui a réagi';
COMMENT ON COLUMN message_reactions.emoji IS 'Emoji de la réaction (ex: ❤️, 👍, 😂)';

-- ✅ NOUVEAU 2025-01-28: Tables de chat de livraison et gamification

-- 1. Table pour les messages de chat de livraison
CREATE TABLE IF NOT EXISTS delivery_chat_messages (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'courier', 'provider')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_chat_messages_delivery_id ON delivery_chat_messages(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_chat_messages_sender_id ON delivery_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_delivery_chat_messages_created_at ON delivery_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_chat_messages_delivery_created ON delivery_chat_messages(delivery_id, created_at DESC);

-- 2. Table pour les statistiques de gamification
CREATE TABLE IF NOT EXISTS delivery_gamification_stats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_deliveries INTEGER DEFAULT 0,
    total_completed_deliveries INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    current_level TEXT DEFAULT 'bronze' CHECK (current_level IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
    badges JSONB DEFAULT '[]'::jsonb,
    achievements JSONB DEFAULT '{}'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_gamification_stats_points ON delivery_gamification_stats(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_gamification_stats_level ON delivery_gamification_stats(current_level);
CREATE INDEX IF NOT EXISTS idx_delivery_gamification_stats_deliveries ON delivery_gamification_stats(total_completed_deliveries DESC);

-- 3. Table pour les badges obtenus
CREATE TABLE IF NOT EXISTS delivery_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_type TEXT NOT NULL,
    badge_name TEXT NOT NULL,
    badge_description TEXT,
    icon_url TEXT,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, badge_type)
);

CREATE INDEX IF NOT EXISTS idx_delivery_badges_user_id ON delivery_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_badges_type ON delivery_badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_delivery_badges_earned_at ON delivery_badges(earned_at DESC);

-- 4. Table pour l'historique des points
CREATE TABLE IF NOT EXISTS delivery_points_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points_change INTEGER NOT NULL,
    reason TEXT NOT NULL,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_points_history_user_id ON delivery_points_history(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_points_history_created_at ON delivery_points_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_points_history_delivery_id ON delivery_points_history(delivery_id);

-- 5. Table pour les suggestions produits IA
CREATE TABLE IF NOT EXISTS delivery_product_suggestions (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    suggested_product_id INTEGER,  -- ✅ Référence optionnelle (table products n'existe pas encore)
    suggested_product_name TEXT NOT NULL,
    suggested_product_price DECIMAL(10, 2),
    suggestion_reason TEXT,
    confidence_score DECIMAL(3, 2) DEFAULT 0.5,
    was_accepted BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_product_suggestions_delivery_id ON delivery_product_suggestions(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_product_suggestions_user_id ON delivery_product_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_product_suggestions_created_at ON delivery_product_suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_product_suggestions_accepted ON delivery_product_suggestions(was_accepted);

COMMENT ON TABLE delivery_chat_messages IS 'Messages de chat pendant les livraisons';
COMMENT ON TABLE delivery_gamification_stats IS 'Statistiques de gamification par utilisateur';
COMMENT ON TABLE delivery_badges IS 'Badges obtenus par les utilisateurs';
COMMENT ON TABLE delivery_points_history IS 'Historique des changements de points';
COMMENT ON TABLE delivery_product_suggestions IS 'Suggestions de produits générées par IA';


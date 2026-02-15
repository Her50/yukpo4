-- Migration pour créer les tables de chat de livraison et gamification
-- Date: 2025-01-28
-- Description: Tables pour gérer les messages de chat pendant les livraisons et la gamification

-- 1. Table pour les messages de chat de livraison
-- ✅ CORRIGÉ 2026-01-29: Créer la table sans contrainte FK d'abord, puis l'ajouter conditionnellement
CREATE TABLE IF NOT EXISTS delivery_chat_messages (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'courier', 'provider')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
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

-- Index pour le classement
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

-- Index pour les badges
CREATE INDEX IF NOT EXISTS idx_delivery_badges_user_id ON delivery_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_badges_type ON delivery_badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_delivery_badges_earned_at ON delivery_badges(earned_at DESC);

-- 4. Table pour l'historique des points (audit trail)
CREATE TABLE IF NOT EXISTS delivery_points_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points_change INTEGER NOT NULL,
    reason TEXT NOT NULL,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour l'historique
CREATE INDEX IF NOT EXISTS idx_delivery_points_history_user_id ON delivery_points_history(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_points_history_created_at ON delivery_points_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_points_history_delivery_id ON delivery_points_history(delivery_id);

-- 5. Table pour les suggestions produits IA
CREATE TABLE IF NOT EXISTS delivery_product_suggestions (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    suggested_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    suggested_product_name TEXT NOT NULL,
    suggested_product_price DECIMAL(10, 2),
    suggestion_reason TEXT,
    confidence_score DECIMAL(3, 2) DEFAULT 0.5,
    was_accepted BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les suggestions
CREATE INDEX IF NOT EXISTS idx_delivery_product_suggestions_delivery_id ON delivery_product_suggestions(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_product_suggestions_user_id ON delivery_product_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_product_suggestions_created_at ON delivery_product_suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_product_suggestions_accepted ON delivery_product_suggestions(was_accepted);

-- Commentaires pour documentation
COMMENT ON TABLE delivery_chat_messages IS 'Messages de chat pendant les livraisons';
COMMENT ON TABLE delivery_gamification_stats IS 'Statistiques de gamification par utilisateur';
COMMENT ON TABLE delivery_badges IS 'Badges obtenus par les utilisateurs';
COMMENT ON TABLE delivery_points_history IS 'Historique des changements de points';
COMMENT ON TABLE delivery_product_suggestions IS 'Suggestions de produits générées par IA';


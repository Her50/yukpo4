-- Migration : Tables pour programme fidélité, chat support et avis tickets
-- Date : 2025-01-27
-- Description : Création des tables nécessaires pour les nouvelles fonctionnalités

-- ============================================================================
-- PROGRAMME FIDÉLITÉ
-- ============================================================================

-- Table des transactions de fidélité
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('earned', 'redeemed', 'expired')),
    points INTEGER NOT NULL CHECK (points > 0),
    description TEXT NOT NULL,
    timestamp BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    expiry_date BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_loyalty_user_id (user_id),
    INDEX idx_loyalty_timestamp (timestamp)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_user_id ON loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_timestamp ON loyalty_transactions(timestamp);

-- Table des récompenses disponibles
CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    points_cost INTEGER NOT NULL CHECK (points_cost > 0),
    discount_percent INTEGER CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_amount INTEGER CHECK (discount_amount >= 0),
    category VARCHAR(50) NOT NULL CHECK (category IN ('discount', 'free_ticket', 'upgrade', 'cashback')),
    available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les récompenses par défaut
INSERT INTO loyalty_rewards (id, name, description, points_cost, discount_percent, category, available)
VALUES
    ('discount_5', 'Réduction 5%', '5% de réduction sur votre prochaine réservation', 100, 5, 'discount', TRUE),
    ('discount_10', 'Réduction 10%', '10% de réduction sur votre prochaine réservation', 200, 10, 'discount', TRUE),
    ('discount_15', 'Réduction 15%', '15% de réduction sur votre prochaine réservation', 300, 15, 'discount', TRUE),
    ('free_ticket', 'Ticket gratuit', 'Un ticket gratuit jusqu''à 5000 FCFA', 500, NULL, 'free_ticket', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CHAT SUPPORT
-- ============================================================================

-- Table des sessions de chat
CREATE TABLE IF NOT EXISTS chat_support_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'closed')),
    topic VARCHAR(200),
    agent_name VARCHAR(200),
    agent_avatar TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    
    INDEX idx_chat_user_id (user_id),
    INDEX idx_chat_status (status),
    INDEX idx_chat_last_message (last_message_at)
);

CREATE INDEX IF NOT EXISTS idx_chat_user_id ON chat_support_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_status ON chat_support_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_last_message ON chat_support_sessions(last_message_at);

-- Table des messages de chat
CREATE TABLE IF NOT EXISTS chat_support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_support_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'support')),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    read BOOLEAN DEFAULT FALSE,
    attachments JSONB,
    
    INDEX idx_chat_messages_session (session_id),
    INDEX idx_chat_messages_timestamp (timestamp)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_support_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_support_messages(timestamp);

-- ============================================================================
-- AVIS TICKETS BUS
-- ============================================================================

-- Table des avis et notations de tickets
CREATE TABLE IF NOT EXISTS bus_ticket_ratings (
    id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(100) NOT NULL,
    payment_id VARCHAR(100) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    categories JSONB, -- ['punctuality', 'comfort', 'cleanliness', 'staff', 'value']
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(ticket_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rating_ticket_user ON bus_ticket_ratings(ticket_id, user_id);
CREATE INDEX IF NOT EXISTS idx_rating_ticket ON bus_ticket_ratings(ticket_id);
CREATE INDEX IF NOT EXISTS idx_rating_user ON bus_ticket_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_rating_created ON bus_ticket_ratings(created_at);

-- Commentaires
COMMENT ON TABLE loyalty_transactions IS 'Transactions du programme de fidélité (points gagnés/utilisés)';
COMMENT ON TABLE loyalty_rewards IS 'Récompenses disponibles dans le programme de fidélité';
COMMENT ON TABLE chat_support_sessions IS 'Sessions de chat support entre utilisateurs et agents';
COMMENT ON TABLE chat_support_messages IS 'Messages échangés dans les sessions de chat support';
COMMENT ON TABLE bus_ticket_ratings IS 'Avis et notations des utilisateurs sur leurs tickets de bus';



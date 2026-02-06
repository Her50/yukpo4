-- Tables de communication (conversations privées, notifications, push tokens)

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
-- ✅ CORRECTION 2026-01-30: DROP avant CREATE pour éviter l'erreur de changement de type de retour
DROP FUNCTION IF EXISTS get_product_reactions_count(INTEGER, TEXT) CASCADE;
CREATE FUNCTION get_product_reactions_count(
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
        CAST(COUNT(*) AS BIGINT) as count,
        CAST(array_agg(COALESCE(u.nom_complet, u.email) ORDER BY pr.created_at DESC) AS TEXT[]) as users_sample
    FROM product_reactions pr
    LEFT JOIN users u ON pr.user_id = u.id
    WHERE pr.service_id = p_service_id
      AND pr.product_id = p_product_id
    GROUP BY pr.reaction_type
    ORDER BY count DESC;
$$;

-- ✅ 2025-12-01 : Table user_push_tokens pour les notifications push
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_token VARCHAR(500) NOT NULL UNIQUE,
    device_type VARCHAR(20) NOT NULL,
    device_id VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_push_token ON user_push_tokens(push_token);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_is_active ON user_push_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_device ON user_push_tokens(device_id);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ✅ CORRECTION 2026-01-30: DROP le trigger avant de le recréer pour éviter "already exists"
DROP TRIGGER IF EXISTS update_user_push_tokens_updated_at ON user_push_tokens;
CREATE TRIGGER update_user_push_tokens_updated_at 
    BEFORE UPDATE ON user_push_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_notifications_user_unread'
    ) THEN
        CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = FALSE;
    END IF;
END $$;




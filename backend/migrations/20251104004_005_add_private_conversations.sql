-- Migration pour conversations privées 1-to-1
-- Date: 2025-11-04
-- Description: Permet aux utilisateurs de discuter en privé entre eux

-- Table pour conversations privées
CREATE TABLE IF NOT EXISTS private_conversations (
    id SERIAL PRIMARY KEY,
    user_1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context TEXT,  -- 'product_review', 'direct_contact', 'mention', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    
    -- Contrainte pour éviter doublons (user_1_id toujours < user_2_id)
    CHECK (user_1_id < user_2_id),
    UNIQUE(user_1_id, user_2_id)
);

-- ✅ SQLx OFFLINE MODE: Créer les index de manière conditionnelle
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

-- Fonction pour normaliser l'ordre des IDs (user_1_id toujours < user_2_id)
CREATE OR REPLACE FUNCTION normalize_conversation_users()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_1_id > NEW.user_2_id THEN
        -- Inverser si user_1 > user_2
        DECLARE
            temp INTEGER;
        BEGIN
            temp := NEW.user_1_id;
            NEW.user_1_id := NEW.user_2_id;
            NEW.user_2_id := temp;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour appliquer la normalisation automatiquement
DROP TRIGGER IF EXISTS trigger_normalize_conversation_users ON private_conversations;
CREATE TRIGGER trigger_normalize_conversation_users
    BEFORE INSERT OR UPDATE ON private_conversations
    FOR EACH ROW
    EXECUTE FUNCTION normalize_conversation_users();

COMMENT ON TABLE private_conversations IS 'Conversations privées 1-to-1 entre utilisateurs (pas liées à un service)';
COMMENT ON FUNCTION normalize_conversation_users IS 'Garantit que user_1_id < user_2_id pour éviter doublons';


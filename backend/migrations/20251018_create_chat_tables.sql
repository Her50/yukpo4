-- Migration pour créer les tables de chat et conversations
-- Date: 2025-10-18
-- Description: Tables pour gérer les conversations et messages entre utilisateurs

-- 1. Table pour les conversations
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prestataire_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    service_title TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_prestataire_id ON conversations(prestataire_id);
CREATE INDEX IF NOT EXISTS idx_conversations_service_id ON conversations(service_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- Contrainte d'unicité pour éviter les conversations dupliquées
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique 
ON conversations(client_id, prestataire_id, service_id) 
WHERE service_id IS NOT NULL;

-- 2. Table pour les messages de chat
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'file')),
    metadata JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_from_user_id ON chat_messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_read ON chat_messages(is_read);

-- Index composite pour requêtes courantes
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created 
ON chat_messages(conversation_id, created_at DESC);

-- 3. Table pour le suivi des messages non lus
CREATE TABLE IF NOT EXISTS chat_unread_counts (
    id SERIAL PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unread_count INTEGER DEFAULT 0,
    last_read_message_id TEXT,
    last_read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_chat_unread_conversation ON chat_unread_counts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_unread_user ON chat_unread_counts(user_id);

-- 4. Fonction pour mettre à jour le last_message_at automatiquement
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON chat_messages;
CREATE TRIGGER trigger_update_conversation_last_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

-- 5. Fonction pour incrémenter le compteur de messages non lus
CREATE OR REPLACE FUNCTION increment_unread_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Incrémenter le compteur pour tous les utilisateurs de la conversation sauf l'expéditeur
    INSERT INTO chat_unread_counts (conversation_id, user_id, unread_count)
    SELECT 
        NEW.conversation_id,
        CASE 
            WHEN c.client_id = NEW.from_user_id THEN c.prestataire_id
            ELSE c.client_id
        END,
        1
    FROM conversations c
    WHERE c.id = NEW.conversation_id
    ON CONFLICT (conversation_id, user_id) 
    DO UPDATE SET 
        unread_count = chat_unread_counts.unread_count + 1,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour incrémenter automatiquement
DROP TRIGGER IF EXISTS trigger_increment_unread_count ON chat_messages;
CREATE TRIGGER trigger_increment_unread_count
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION increment_unread_count();

-- Commentaires pour la documentation
COMMENT ON TABLE conversations IS 'Conversations entre clients et prestataires';
COMMENT ON TABLE chat_messages IS 'Messages échangés dans les conversations';
COMMENT ON TABLE chat_unread_counts IS 'Compteur de messages non lus par utilisateur et conversation';
COMMENT ON COLUMN conversations.status IS 'active: en cours, completed: terminée, cancelled: annulée';
COMMENT ON COLUMN chat_messages.message_type IS 'Type de message: text, image, audio, video, file';


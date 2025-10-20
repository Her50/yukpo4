-- Migration pour système @mention et multi-participants dans conversations
-- Date: 2025-10-20
-- Description: Permet d'inviter plusieurs utilisateurs dans une conversation

-- 1. Table pour gérer les participants d'une conversation
CREATE TABLE IF NOT EXISTS conversation_participants (
    id SERIAL PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(20) DEFAULT 'participant' CHECK (role IN ('owner', 'participant', 'guest')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    can_remove BOOLEAN DEFAULT TRUE, -- Si false, le participant ne peut pas être retiré
    first_visible_message_id TEXT, -- Premier message visible par ce participant
    last_read_message_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    left_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_active ON conversation_participants(is_active);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_invited_by ON conversation_participants(invited_by);

-- 2. Table pour l'historique des tags/mentions
CREATE TABLE IF NOT EXISTS conversation_tag_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tagged_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    context VARCHAR(50), -- Ex: 'product_category', 'user_search', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour récupérer rapidement l'historique
CREATE INDEX IF NOT EXISTS idx_tag_history_user ON conversation_tag_history(user_id, tagged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tag_history_tagged_user ON conversation_tag_history(tagged_user_id);

-- 3. Ajouter champ mentions dans chat_messages
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS mentioned_users INTEGER[] DEFAULT '{}';

-- Index GIN pour recherche rapide des mentions
CREATE INDEX IF NOT EXISTS idx_chat_messages_mentions ON chat_messages USING GIN(mentioned_users);

-- 4. Fonction pour initialiser les participants d'une conversation existante
-- Cette fonction migre les conversations existantes vers le nouveau système
DO $$
DECLARE
    conv RECORD;
BEGIN
    FOR conv IN SELECT id, client_id, prestataire_id FROM conversations
    LOOP
        -- Ajouter le client comme owner
        INSERT INTO conversation_participants (conversation_id, user_id, invited_by, role, can_remove, first_visible_message_id)
        VALUES (conv.id, conv.client_id, NULL, 'owner', FALSE, NULL)
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
        
        -- Ajouter le prestataire comme owner
        INSERT INTO conversation_participants (conversation_id, user_id, invited_by, role, can_remove, first_visible_message_id)
        VALUES (conv.id, conv.prestataire_id, NULL, 'owner', FALSE, NULL)
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END LOOP;
END $$;

-- 5. Vue pour faciliter les requêtes
CREATE OR REPLACE VIEW conversation_participants_view AS
SELECT 
    cp.*,
    u.nom_complet as user_name,
    u.email as user_email,
    u.avatar_url as user_avatar,
    inv.nom_complet as invited_by_name,
    c.service_title,
    c.status as conversation_status
FROM conversation_participants cp
JOIN users u ON cp.user_id = u.id
LEFT JOIN users inv ON cp.invited_by = inv.id
JOIN conversations c ON cp.conversation_id = c.id
WHERE cp.is_active = TRUE;

-- 6. Fonction pour compter les participants actifs
CREATE OR REPLACE FUNCTION count_active_participants(conv_id TEXT)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER 
    FROM conversation_participants 
    WHERE conversation_id = conv_id AND is_active = TRUE;
$$ LANGUAGE SQL STABLE;

-- 7. Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_conversation_participants_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_participants_timestamp
BEFORE UPDATE ON conversation_participants
FOR EACH ROW
EXECUTE FUNCTION update_conversation_participants_timestamp();

-- Commentaires pour documentation
COMMENT ON TABLE conversation_participants IS 'Participants d''une conversation (système multi-utilisateurs avec @mention)';
COMMENT ON COLUMN conversation_participants.role IS 'owner: créateur, participant: invité qui peut inviter, guest: invité simple';
COMMENT ON COLUMN conversation_participants.can_remove IS 'Si FALSE, le participant ne peut pas être retiré (ex: client et prestataire initiaux)';
COMMENT ON COLUMN conversation_participants.first_visible_message_id IS 'Premier message visible par ce participant (pour confidentialité historique)';
COMMENT ON TABLE conversation_tag_history IS 'Historique des personnes taguées pour suggestions intelligentes';
COMMENT ON COLUMN chat_messages.mentioned_users IS 'IDs des utilisateurs mentionnés dans le message (@mention)';


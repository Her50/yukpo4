-- Migration pour ajouter le support des réponses/citations dans les messages du chat
-- Permet aux utilisateurs de répondre à un message spécifique pour un contexte clair

-- Ajouter la colonne reply_to_message_id à la table chat_messages
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS reply_to_message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL;

-- Ajouter un commentaire explicatif
COMMENT ON COLUMN chat_messages.reply_to_message_id IS 'ID du message auquel on répond (système de citation/réponse)';

-- Créer un index pour améliorer les performances de recherche des réponses
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to ON chat_messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;

-- Créer une vue pour faciliter la récupération des messages avec leurs citations
CREATE OR REPLACE VIEW chat_messages_with_replies AS
SELECT 
    m.*,
    r.id as reply_to_id,
    r.sender_id as reply_to_sender_id,
    r.content as reply_to_content,
    r.content_type as reply_to_content_type,
    r.created_at as reply_to_created_at,
    u.name as reply_to_sender_name
FROM chat_messages m
LEFT JOIN chat_messages r ON m.reply_to_message_id = r.id
LEFT JOIN users u ON r.sender_id = u.id;

COMMENT ON VIEW chat_messages_with_replies IS 'Vue combinant les messages avec leurs citations pour faciliter les requêtes';

-- Fonction pour obtenir les messages d'une conversation avec leurs citations
CREATE OR REPLACE FUNCTION get_conversation_messages_with_replies(
    p_conversation_id INTEGER,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    message_id INTEGER,
    conversation_id INTEGER,
    sender_id INTEGER,
    sender_name TEXT,
    content TEXT,
    content_type VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    is_edited BOOLEAN,
    reply_to_id INTEGER,
    reply_to_sender_id INTEGER,
    reply_to_sender_name TEXT,
    reply_to_content TEXT,
    reply_to_content_type VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id as message_id,
        m.conversation_id,
        m.sender_id,
        u1.name as sender_name,
        m.content,
        m.content_type,
        m.created_at,
        m.updated_at,
        m.is_edited,
        r.id as reply_to_id,
        r.sender_id as reply_to_sender_id,
        u2.name as reply_to_sender_name,
        r.content as reply_to_content,
        r.content_type as reply_to_content_type
    FROM chat_messages m
    INNER JOIN users u1 ON m.sender_id = u1.id
    LEFT JOIN chat_messages r ON m.reply_to_message_id = r.id
    LEFT JOIN users u2 ON r.sender_id = u2.id
    WHERE m.conversation_id = p_conversation_id
    ORDER BY m.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_conversation_messages_with_replies IS 'Récupère les messages d''une conversation avec leurs citations';


-- Migration: Ajouter support pour réactions aux messages
-- Date: 2025-01-27

-- Table pour stocker les réactions aux messages
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

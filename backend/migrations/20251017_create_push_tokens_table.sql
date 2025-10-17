-- Migration pour créer la table des tokens de push notifications
-- Créée le 2025-10-17

-- Table des tokens push pour notifications
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL UNIQUE, -- Token Expo ou FCM
    device_type VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
    device_id VARCHAR(255), -- Identifiant unique de l'appareil
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_active ON user_push_tokens(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_device ON user_push_tokens(user_id, device_type);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_push_token_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
CREATE TRIGGER update_user_push_tokens_timestamp
    BEFORE UPDATE ON user_push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_push_token_timestamp();

-- Commentaires
COMMENT ON TABLE user_push_tokens IS 'Tokens de push notifications pour les utilisateurs';
COMMENT ON COLUMN user_push_tokens.push_token IS 'Token Expo Push Notifications ou FCM';
COMMENT ON COLUMN user_push_tokens.device_type IS 'Type d''appareil (ios, android, web)';
COMMENT ON COLUMN user_push_tokens.is_active IS 'Indique si le token est encore valide';


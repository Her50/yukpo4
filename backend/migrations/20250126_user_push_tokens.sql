-- Migration pour les tokens de notification push des utilisateurs
-- Permet de stocker les tokens Expo Push et d'envoyer des notifications

-- Table des tokens de notification push
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    push_token TEXT NOT NULL,
    platform TEXT NOT NULL, -- 'ios', 'android'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Index pour recherche rapide par utilisateur
    CONSTRAINT unique_user_push_token UNIQUE (user_id, push_token)
);

-- Index pour recherche par utilisateur
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_active ON user_push_tokens(is_active) WHERE is_active = TRUE;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_user_push_tokens_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_push_tokens_timestamp
    BEFORE UPDATE ON user_push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_user_push_tokens_timestamp();

-- Commentaires
COMMENT ON TABLE user_push_tokens IS 'Stocke les tokens Expo Push des utilisateurs pour les notifications';
COMMENT ON COLUMN user_push_tokens.push_token IS 'Token Expo Push (format: ExponentPushToken[...])';
COMMENT ON COLUMN user_push_tokens.platform IS 'Plateforme: ios ou android';
COMMENT ON COLUMN user_push_tokens.is_active IS 'Indique si le token est encore valide';


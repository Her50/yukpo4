-- Migration de production pour créer la table des tokens push
-- Date: 2025-10-17
-- Cette migration sera appliquée automatiquement sur Render

-- Vérifier et créer la table user_push_tokens
DO $$
BEGIN
    -- Créer la table user_push_tokens si elle n'existe pas
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_push_tokens') THEN
        CREATE TABLE user_push_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            push_token VARCHAR(500) NOT NULL UNIQUE,
            device_type VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
            device_id VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Créer les index pour user_push_tokens
        CREATE INDEX idx_user_push_tokens_user_id ON user_push_tokens(user_id);
        CREATE INDEX idx_user_push_tokens_push_token ON user_push_tokens(push_token);
        CREATE INDEX idx_user_push_tokens_is_active ON user_push_tokens(is_active);
        CREATE INDEX idx_user_push_tokens_device ON user_push_tokens(device_id);
        
        -- Ajouter les commentaires
        COMMENT ON TABLE user_push_tokens IS 'Tokens de notifications push pour chaque appareil utilisateur';
        COMMENT ON COLUMN user_push_tokens.push_token IS 'Token Expo Push Notification';
        COMMENT ON COLUMN user_push_tokens.device_type IS 'Type d''appareil (ios, android, web)';
        COMMENT ON COLUMN user_push_tokens.device_id IS 'Identifiant unique de l''appareil';
        COMMENT ON COLUMN user_push_tokens.is_active IS 'Indique si le token est actif';
        COMMENT ON COLUMN user_push_tokens.last_used_at IS 'Dernière fois que le token a été utilisé';
        
        RAISE NOTICE 'Table user_push_tokens créée avec succès';
    ELSE
        RAISE NOTICE 'Table user_push_tokens existe déjà';
    END IF;
END $$;

-- Créer ou remplacer la fonction de mise à jour du timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Créer le trigger pour updated_at si nécessaire
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_push_tokens_updated_at') THEN
        CREATE TRIGGER update_user_push_tokens_updated_at 
            BEFORE UPDATE ON user_push_tokens 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Trigger update_user_push_tokens_updated_at créé';
    ELSE
        RAISE NOTICE 'Trigger update_user_push_tokens_updated_at existe déjà';
    END IF;
END $$;

-- Migration pour les tokens de notification push des utilisateurs
-- Permet de stocker les tokens Expo Push et d'envoyer des notifications

-- ✅ CORRIGÉ 2026-02-15: Vérifier si la table existe avec un schéma différent
DO $$
BEGIN
    -- Si la table existe mais n'a pas la colonne "platform" (a "device_type" à la place)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_push_tokens')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_push_tokens' AND column_name = 'platform') THEN
        -- La table existe avec un schéma différent, on ajoute la colonne platform si nécessaire
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_push_tokens' AND column_name = 'platform') THEN
            ALTER TABLE user_push_tokens ADD COLUMN platform TEXT;
            -- Copier device_type vers platform si device_type existe
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_push_tokens' AND column_name = 'device_type') THEN
                UPDATE user_push_tokens SET platform = device_type WHERE platform IS NULL;
            END IF;
            ALTER TABLE user_push_tokens ALTER COLUMN platform SET NOT NULL;
        END IF;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_push_tokens') THEN
        -- Créer la table seulement si elle n'existe pas
        CREATE TABLE user_push_tokens (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            push_token TEXT NOT NULL,
            platform TEXT NOT NULL, -- 'ios', 'android'
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            -- Index pour recherche rapide par utilisateur
            CONSTRAINT unique_user_push_token UNIQUE (user_id, push_token)
        );
    END IF;
END $$;

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


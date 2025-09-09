-- Migration pour créer les tables des fonctionnalités avancées
-- Notifications push, statut de frappe, messages vocaux, partage de fichiers

-- 1. Table pour les subscriptions push
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- 2. Table pour les messages vocaux
CREATE TABLE IF NOT EXISTS voice_messages (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    duration_seconds REAL NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_processed BOOLEAN DEFAULT FALSE,
    transcription TEXT
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_voice_messages_user_id ON voice_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_messages_chat_id ON voice_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_voice_messages_created_at ON voice_messages(created_at);

-- 3. Table pour le partage de fichiers
CREATE TABLE IF NOT EXISTS shared_files (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    download_count INTEGER DEFAULT 0,
    max_downloads INTEGER,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_shared_files_user_id ON shared_files(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_files_chat_id ON shared_files(chat_id);
CREATE INDEX IF NOT EXISTS idx_shared_files_expires_at ON shared_files(expires_at);
CREATE INDEX IF NOT EXISTS idx_shared_files_created_at ON shared_files(created_at);

-- 4. Table pour le suivi des téléchargements
CREATE TABLE IF NOT EXISTS file_downloads (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL REFERENCES shared_files(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_file_downloads_file_id ON file_downloads(file_id);
CREATE INDEX IF NOT EXISTS idx_file_downloads_user_id ON file_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_downloads_downloaded_at ON file_downloads(downloaded_at);

-- 5. Table pour le statut de frappe (optionnel, peut être géré en mémoire)
CREATE TABLE IF NOT EXISTS typing_status (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    is_typing BOOLEAN DEFAULT FALSE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_typing_status_user_id ON typing_status(user_id);
CREATE INDEX IF NOT EXISTS idx_typing_status_chat_id ON typing_status(chat_id);
CREATE INDEX IF NOT EXISTS idx_typing_status_last_activity ON typing_status(last_activity);

-- Contraintes d'unicité
ALTER TABLE push_subscriptions ADD CONSTRAINT unique_user_endpoint UNIQUE(user_id, endpoint);
ALTER TABLE typing_status ADD CONSTRAINT unique_user_chat UNIQUE(user_id, chat_id);

-- Commentaires pour la documentation
COMMENT ON TABLE push_subscriptions IS 'Subscriptions pour les notifications push du navigateur';
COMMENT ON TABLE voice_messages IS 'Messages vocaux enregistrés par les utilisateurs';
COMMENT ON TABLE shared_files IS 'Fichiers partagés entre utilisateurs';
COMMENT ON TABLE file_downloads IS 'Suivi des téléchargements de fichiers';
COMMENT ON TABLE typing_status IS 'Statut de frappe des utilisateurs dans les chats'; 
-- Migration pour créer la table des notifications système
-- Créée le 2025-10-17

-- Table des notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'service_created', 'service_activated', 'service_deactivated', 'low_balance', 'payment_received', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- Données additionnelles (service_id, amount, etc.)
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Commentaires
COMMENT ON TABLE notifications IS 'Notifications système pour les utilisateurs';
COMMENT ON COLUMN notifications.type IS 'Type de notification (service_created, low_balance, etc.)';
COMMENT ON COLUMN notifications.data IS 'Données JSON additionnelles spécifiques au type de notification';
COMMENT ON COLUMN notifications.is_read IS 'Indique si la notification a été lue';
COMMENT ON COLUMN notifications.read_at IS 'Date et heure de lecture de la notification';


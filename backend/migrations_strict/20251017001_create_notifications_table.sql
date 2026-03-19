-- Migration de production pour créer la table des notifications
-- Date: 2025-10-17
-- Cette migration sera appliquée automatiquement sur Render

-- Vérifier et créer la table notifications
DO $$
BEGIN
    -- Créer la table notifications si elle n'existe pas
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
        CREATE TABLE notifications (
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
        
        -- Créer les index pour notifications
        CREATE INDEX idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX idx_notifications_is_read ON notifications(is_read);
        CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
        CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
        
        -- Ajouter les commentaires
        COMMENT ON TABLE notifications IS 'Notifications système pour les utilisateurs';
        COMMENT ON COLUMN notifications.type IS 'Type de notification (service_created, low_balance, etc.)';
        COMMENT ON COLUMN notifications.data IS 'Données JSON additionnelles spécifiques au type de notification';
        COMMENT ON COLUMN notifications.is_read IS 'Indique si la notification a été lue';
        COMMENT ON COLUMN notifications.read_at IS 'Date et heure de lecture de la notification';
        
        RAISE NOTICE 'Table notifications créée avec succès';
    ELSE
        RAISE NOTICE 'Table notifications existe déjà';
    END IF;
END $$;

-- Migration pour corriger le nom de colonne dans la table notifications
-- Date: 2025-01-22
-- Compatible avec sqlx offline mode
-- 
-- Problème: La table utilise 'type' mais le code Rust utilise 'notification_type'
-- Solution: Renommer la colonne 'type' en 'notification_type' pour cohérence

-- Renommer la colonne si elle existe et si notification_type n'existe pas
DO $$
BEGIN
    -- Vérifier si la colonne 'type' existe et si 'notification_type' n'existe pas
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'type'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'notification_type'
    ) THEN
        -- Renommer la colonne
        ALTER TABLE notifications RENAME COLUMN type TO notification_type;
        RAISE NOTICE 'Colonne notifications.type renommée en notification_type';
    ELSIF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'notification_type'
    ) THEN
        RAISE NOTICE 'Colonne notification_type existe déjà';
    ELSE
        RAISE NOTICE 'Colonne type non trouvée dans notifications';
    END IF;
END $$;

-- Vérifier et mettre à jour les index si nécessaire
DO $$
BEGIN
    -- Recréer l'index si nécessaire (PostgreSQL le recrée automatiquement lors du rename)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'notifications' 
        AND indexname = 'idx_notifications_type'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
    END IF;
END $$;

COMMENT ON COLUMN notifications.notification_type IS 'Type de notification (service_created, low_balance, etc.)';


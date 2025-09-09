-- Migration : Ajout de la colonne 'last_alert_sent_at' à la table 'services'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'last_alert_sent_at') THEN
        ALTER TABLE services ADD COLUMN last_alert_sent_at TIMESTAMP;
    END IF;
END $$;
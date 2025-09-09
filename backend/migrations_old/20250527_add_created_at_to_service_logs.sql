-- Migration : Ajout de la colonne 'created_at' à la table 'service_logs'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_logs' AND column_name = 'created_at') THEN
        ALTER TABLE service_logs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
-- Migration : Ajout de la colonne 'modification' à la table 'service_logs'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_logs' AND column_name = 'modification') THEN
        ALTER TABLE service_logs ADD COLUMN modification TEXT;
    END IF;
END $$;
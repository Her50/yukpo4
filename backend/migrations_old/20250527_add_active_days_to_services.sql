-- Migration : Ajout de la colonne active_days à la table services
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'active_days') THEN
        ALTER TABLE services ADD COLUMN active_days INTEGER;
    END IF;
END $$;
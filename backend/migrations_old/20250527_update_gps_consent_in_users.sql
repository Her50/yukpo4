-- Migration : Ajout de la colonne `gps_consent` à la table `users` avec une valeur par défaut de `true`
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'gps_consent') THEN
        ALTER TABLE users ADD COLUMN gps_consent BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Modification de la valeur par défaut de la colonne gps_consent
ALTER TABLE users ALTER COLUMN gps_consent SET DEFAULT TRUE;
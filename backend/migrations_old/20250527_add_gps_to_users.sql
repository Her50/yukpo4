-- Migration : Ajout de la colonne `gps` à la table `users`
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'gps') THEN
        ALTER TABLE users ADD COLUMN gps VARCHAR(255);
    END IF;
END $$;

-- Suppression de la tentative de création de la colonne `gps_consent`
-- Cette colonne est déjà gérée dans une autre migration.
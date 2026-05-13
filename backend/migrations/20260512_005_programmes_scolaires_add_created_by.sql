-- Audit trail : qui a importé/créé chaque entrée programmes_scolaires.
-- Le contrôleur `etablissement_programmes_controller` référence déjà cette
-- colonne dans ses INSERT (preload + création manuelle), ce qui causait
-- l'erreur runtime « column "created_by" of relation "programmes_scolaires"
-- does not exist » lors de l'utilisation du programme national officiel.

ALTER TABLE programmes_scolaires
    ADD COLUMN IF NOT EXISTS created_by INTEGER;

-- FK soft vers users.id (SET NULL si l'utilisateur est supprimé).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'programmes_scolaires_created_by_fkey'
       )
    THEN
        ALTER TABLE programmes_scolaires
            ADD CONSTRAINT programmes_scolaires_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_programmes_created_by
    ON programmes_scolaires(created_by) WHERE created_by IS NOT NULL;

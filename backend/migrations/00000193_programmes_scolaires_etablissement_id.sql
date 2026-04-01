-- Migration: programmes_scolaires.etablissement_id (Bourse du livre — priorité établissement > Yukpo national)
-- Date: 2026-03-24
-- Prérequis: table programmes_scolaires (schéma Bourse V2), table etablissements_scolaires (orientation)

ALTER TABLE programmes_scolaires
    ADD COLUMN IF NOT EXISTS etablissement_id INTEGER REFERENCES etablissements_scolaires(id) ON DELETE SET NULL;

-- Index partiel seulement si la colonne is_active existe (schéma Bourse V2)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'programmes_scolaires'
          AND column_name = 'is_active'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_programmes_etab_classe_active
            ON programmes_scolaires(etablissement_id, classe)
            WHERE is_active = true AND etablissement_id IS NOT NULL;
    END IF;
END $$;

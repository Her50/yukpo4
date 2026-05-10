-- ============================================================================
-- Migration 20260510_009 : aligne programmes_scolaires sur le schéma complet
-- ============================================================================
-- Sur certaines instances historiques, la table a été créée avec le schéma
-- simple {id, etablissement, classe, annee, programme jsonb}. Les contrôleurs
-- récents (etablissement_programmes_controller, parent_suggestions_controller)
-- utilisent les colonnes pays, systeme_educatif, niveau, matiere, titre_livre,
-- auteur_livre, editeur_livre, isbn_livre, annee_scolaire, prix_officiel,
-- devise, est_obligatoire, is_active, etablissement_id, type_article,
-- quantite_defaut. Cette migration garantit leur présence (idempotente).
-- ============================================================================

BEGIN;

ALTER TABLE programmes_scolaires
    ADD COLUMN IF NOT EXISTS pays TEXT NOT NULL DEFAULT 'Cameroun',
    ADD COLUMN IF NOT EXISTS systeme_educatif TEXT NOT NULL DEFAULT 'francophone',
    ADD COLUMN IF NOT EXISTS niveau TEXT,
    ADD COLUMN IF NOT EXISTS matiere TEXT,
    ADD COLUMN IF NOT EXISTS titre_livre TEXT,
    ADD COLUMN IF NOT EXISTS auteur_livre TEXT,
    ADD COLUMN IF NOT EXISTS editeur_livre TEXT,
    ADD COLUMN IF NOT EXISTS isbn_livre TEXT,
    ADD COLUMN IF NOT EXISTS annee_scolaire TEXT,
    ADD COLUMN IF NOT EXISTS est_obligatoire BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS keywords TEXT[],
    ADD COLUMN IF NOT EXISTS prix_officiel DECIMAL(12, 2),
    ADD COLUMN IF NOT EXISTS devise TEXT DEFAULT 'XAF',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS etablissement_id INTEGER,
    ADD COLUMN IF NOT EXISTS type_article TEXT NOT NULL DEFAULT 'livre',
    ADD COLUMN IF NOT EXISTS quantite_defaut INTEGER DEFAULT 1;

-- FK vers etablissements_scolaires (si pas déjà posée)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'etablissements_scolaires')
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'programmes_scolaires_etablissement_id_fkey'
       )
    THEN
        ALTER TABLE programmes_scolaires
            ADD CONSTRAINT programmes_scolaires_etablissement_id_fkey
            FOREIGN KEY (etablissement_id) REFERENCES etablissements_scolaires(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Check sur type_article (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'programmes_scolaires_type_article_check'
    ) THEN
        ALTER TABLE programmes_scolaires
            ADD CONSTRAINT programmes_scolaires_type_article_check
            CHECK (type_article IN ('livre', 'workbook', 'cahier', 'fourniture', 'accessoire'));
    END IF;
END $$;

-- Indices utiles pour les filtres parent_suggestions
CREATE INDEX IF NOT EXISTS idx_programmes_classe_type_active
    ON programmes_scolaires (classe, type_article)
    WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_programmes_etab_active
    ON programmes_scolaires (etablissement_id)
    WHERE is_active = true;

COMMIT;

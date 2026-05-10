-- ============================================================================
-- Migration : Setup étendu établissement (nom abrégé + système scolaire + cycles)
-- Date : 2026-05-10
-- ============================================================================
-- 1. etablissements_scolaires :
--      nom_abrege         : forme courte populaire (ex "CBLG" pour "Collège Bilingue La Gaieté")
--      systeme_scolaire   : 'francophone' | 'anglophone' | 'bilingue'
--      cycles_offerts     : array de cycles (maternelle, primaire, college, lycee, technique, superieur)
--    + index trigram sur nom_abrege pour la recherche cross-name côté parent
-- 2. programmes_scolaires :
--      type_article       : 'livre' | 'cahier' | 'fourniture' | 'accessoire' | 'workbook'
--      quantite_defaut    : quantité par défaut (ex: 6 cahiers de 100 pages pour la 6e)
-- ============================================================================

BEGIN;

-- 1. etablissements_scolaires
ALTER TABLE etablissements_scolaires
    ADD COLUMN IF NOT EXISTS nom_abrege TEXT,
    ADD COLUMN IF NOT EXISTS systeme_scolaire TEXT,
    ADD COLUMN IF NOT EXISTS cycles_offerts TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'etablissements_systeme_scolaire_check'
    ) THEN
        ALTER TABLE etablissements_scolaires
            ADD CONSTRAINT etablissements_systeme_scolaire_check
            CHECK (systeme_scolaire IS NULL OR systeme_scolaire IN ('francophone', 'anglophone', 'bilingue'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_etablissements_nom_abrege_trgm
    ON etablissements_scolaires USING GIN (nom_abrege gin_trgm_ops)
    WHERE nom_abrege IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_etablissements_systeme_pays
    ON etablissements_scolaires(pays, systeme_scolaire)
    WHERE systeme_scolaire IS NOT NULL AND is_active = true;

-- 2. programmes_scolaires
ALTER TABLE programmes_scolaires
    ADD COLUMN IF NOT EXISTS type_article TEXT NOT NULL DEFAULT 'livre',
    ADD COLUMN IF NOT EXISTS quantite_defaut INTEGER NOT NULL DEFAULT 1;

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

CREATE INDEX IF NOT EXISTS idx_programmes_etab_classe_annee_type
    ON programmes_scolaires(etablissement_id, classe, annee_scolaire, type_article)
    WHERE is_active = true;

COMMIT;

-- ============================================================================
-- Notes UX :
-- - Le nom_abrege est rempli soit par l'admin soit auto-extrait par l'IA.
-- - cycles_offerts permet à la page admin "Liste scolaire" de proposer
--   uniquement les classes pertinentes (ex: pas de Terminale si seulement primaire).
-- - type_article = 'fourniture' / 'cahier' / 'accessoire' couvre tout ce qui n'est
--   pas un livre du programme officiel. quantite_defaut = qté demandée par l'école.
-- ============================================================================

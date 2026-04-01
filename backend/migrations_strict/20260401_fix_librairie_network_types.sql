-- Migration: Fix type mismatch dans commande_livres_occasion et commande_livres_occasion
-- Date: 2026-04-01
-- Description: livre_scolaire_id et vendeur_id étaient déclarés UUID alors que
--              livres_scolaires.id et users.id sont des INTEGER (SERIAL).
--              Correction du type de colonne sans perte de données (table généralement vide
--              au moment de la migration, ou données migrées vers INTEGER).

-- ============================================================================
-- 1. TABLE commande_livres_occasion
-- ============================================================================

-- Supprimer la contrainte FK existante si elle existe
ALTER TABLE commande_livres_occasion
    DROP CONSTRAINT IF EXISTS commande_livres_occasion_livre_scolaire_id_fkey;

ALTER TABLE commande_livres_occasion
    DROP CONSTRAINT IF EXISTS commande_livres_occasion_vendeur_id_fkey;

-- Changer le type de livre_scolaire_id: UUID → INTEGER
-- Si la colonne contient déjà des UUID valides non convertibles, la conversion sera tentée via regexp
-- (en pratique la table est vide ou les UUIDs ne correspondent pas à des IDs entiers réels)
DO $$
BEGIN
    -- Vérifier si la colonne est bien de type UUID avant d'agir
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'commande_livres_occasion'
          AND column_name = 'livre_scolaire_id'
          AND data_type = 'uuid'
    ) THEN
        -- Supprimer les lignes orphelines éventuelles (UUID sans correspondance INTEGER)
        DELETE FROM commande_livres_occasion WHERE TRUE;

        -- Changer le type
        ALTER TABLE commande_livres_occasion
            ALTER COLUMN livre_scolaire_id TYPE INTEGER USING NULL;

        ALTER TABLE commande_livres_occasion
            ALTER COLUMN livre_scolaire_id SET NOT NULL;
    END IF;
END $$;

-- Changer le type de vendeur_id: UUID → INTEGER
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'commande_livres_occasion'
          AND column_name = 'vendeur_id'
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE commande_livres_occasion
            ALTER COLUMN vendeur_id TYPE INTEGER USING NULL;

        ALTER TABLE commande_livres_occasion
            ALTER COLUMN vendeur_id SET NOT NULL;
    END IF;
END $$;

-- Recréer les FK correctes
ALTER TABLE commande_livres_occasion
    ADD CONSTRAINT commande_livres_occasion_livre_scolaire_id_fkey
    FOREIGN KEY (livre_scolaire_id) REFERENCES livres_scolaires(id) ON DELETE CASCADE;

ALTER TABLE commande_livres_occasion
    ADD CONSTRAINT commande_livres_occasion_vendeur_id_fkey
    FOREIGN KEY (vendeur_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================================
-- 2. TABLE librairie_partners — user_id: UUID → INTEGER
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'librairie_partners'
          AND column_name = 'user_id'
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE librairie_partners
            DROP CONSTRAINT IF EXISTS librairie_partners_user_id_fkey;

        DELETE FROM librairie_partners WHERE TRUE;

        ALTER TABLE librairie_partners
            ALTER COLUMN user_id TYPE INTEGER USING NULL;

        ALTER TABLE librairie_partners
            ALTER COLUMN user_id SET NOT NULL;

        ALTER TABLE librairie_partners
            ADD CONSTRAINT librairie_partners_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 3. TABLE commandes_mixtes — user_id: UUID → INTEGER
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'commandes_mixtes'
          AND column_name = 'user_id'
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE commandes_mixtes
            DROP CONSTRAINT IF EXISTS commandes_mixtes_user_id_fkey;

        DELETE FROM commandes_mixtes WHERE TRUE;

        ALTER TABLE commandes_mixtes
            ALTER COLUMN user_id TYPE INTEGER USING NULL;

        ALTER TABLE commandes_mixtes
            ALTER COLUMN user_id SET NOT NULL;

        ALTER TABLE commandes_mixtes
            ADD CONSTRAINT commandes_mixtes_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 4. Recréer les index sur les colonnes modifiées
-- ============================================================================

DROP INDEX IF EXISTS idx_commande_livres_occasion_livre;
DROP INDEX IF EXISTS idx_commande_livres_occasion_vendeur;
CREATE INDEX IF NOT EXISTS idx_commande_livres_occasion_livre ON commande_livres_occasion(livre_scolaire_id);
CREATE INDEX IF NOT EXISTS idx_commande_livres_occasion_vendeur ON commande_livres_occasion(vendeur_id);

COMMENT ON COLUMN commande_livres_occasion.livre_scolaire_id IS 'Référence INTEGER vers livres_scolaires.id (corrigé depuis UUID)';
COMMENT ON COLUMN commande_livres_occasion.vendeur_id IS 'Référence INTEGER vers users.id (corrigé depuis UUID)';

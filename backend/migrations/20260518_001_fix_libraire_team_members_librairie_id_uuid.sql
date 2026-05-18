-- =============================================================================
-- Migration 20260518_001 — fix(bug I) : libraire_team_members.librairie_id
-- doit être UUID (référence à librairie_partners.id qui est UUID), pas
-- INTEGER comme défini dans auto_migrate.rs:21446-21458.
--
-- Symptôme révélé par sim E2E itér 5 :
--   POST /api/librairie-network/validation/valider → 500 INTERNAL_ERROR
--   "Erreur team: operator does not exist: integer = uuid"
--
-- Cause : controllers/librairie_network_controller.rs:3039-3047 fait
--   JOIN libraire_team_members tm ON tm.librairie_id = lp.id
-- Postgres refuse la comparaison integer=uuid.
--
-- Stratégie : idempotente — détecte le type actuel via information_schema,
-- ne touche rien si déjà UUID. Si INTEGER, DROP la colonne (vide en pratique
-- vu que le flux team n'a jamais marché) et la recrée en UUID + FK propre.
-- =============================================================================

DO $$
DECLARE
    col_type TEXT;
    fk_exists BOOLEAN;
BEGIN
    -- Vérifier que la table existe (skip si absente — pas de fail)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema='public' AND table_name='libraire_team_members') THEN
        RAISE NOTICE 'libraire_team_members absente — skip migration';
        RETURN;
    END IF;

    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='libraire_team_members' AND column_name='librairie_id';

    IF col_type = 'uuid' THEN
        RAISE NOTICE 'libraire_team_members.librairie_id déjà UUID — skip';
    ELSIF col_type IN ('integer','bigint') THEN
        RAISE NOTICE 'Conversion libraire_team_members.librairie_id % -> UUID', col_type;
        -- Drop FK existante si elle existe (rare car la colonne pointait sur rien de cohérent)
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema='public' AND table_name='libraire_team_members'
              AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%librairie%'
        ) INTO fk_exists;
        IF fk_exists THEN
            EXECUTE 'ALTER TABLE libraire_team_members DROP CONSTRAINT IF EXISTS libraire_team_members_librairie_id_fkey';
        END IF;
        -- En staging la table est purgée à chaque run ; en prod la table devrait être vide
        -- car le flux team n'a jamais fonctionné (toujours renvoyé 500). On peut donc DROP
        -- + recréer la colonne sans perte de données réelles.
        EXECUTE 'ALTER TABLE libraire_team_members DROP COLUMN librairie_id';
        EXECUTE 'ALTER TABLE libraire_team_members ADD COLUMN librairie_id UUID NOT NULL REFERENCES librairie_partners(id) ON DELETE CASCADE';
        -- Recréer l'index unique (libraire_id, user_id)
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_libraire_team_librairie ON libraire_team_members(librairie_id) WHERE is_active = true';
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_libraire_team_member ON libraire_team_members(librairie_id, user_id)';
        RAISE NOTICE 'libraire_team_members.librairie_id converti en UUID + FK + index recréés';
    ELSE
        RAISE NOTICE 'libraire_team_members.librairie_id type inattendu : %', col_type;
    END IF;
END $$;

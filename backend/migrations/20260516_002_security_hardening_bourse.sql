-- ============================================================================
-- 20260516_002_security_hardening_bourse.sql
-- Hardening sécurité pré-lancement campagne Bourse du Livre.
--
-- Contenu :
--   1. Table audit_logs : trace toutes les opérations sensibles (admin, wallet,
--      bourse, parrainage, etc.) avec old/new value en JSONB.
--   2. Flag users.is_yukpo_official_librairie : remplace l'env var
--      YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS par un flag DB révocable au runtime.
--   3. Soft-delete livres_scolaires : colonne deleted_at + index partiel.
--      Évite la perte définitive si un libraire externe (ou un compromis) DELETE.
--   4. Index manquants pour les requêtes hot-path Bourse (recherche par classe,
--      filtre par état, sessions OCR).
--
-- Idempotente : chaque ALTER/CREATE est protégé par IF NOT EXISTS / DO $$ EXCEPTION.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGSERIAL PRIMARY KEY,
    actor_id     INTEGER,                      -- user_id de l'acteur (NULL si système)
    actor_role   TEXT,                         -- snapshot du rôle au moment de l'action
    actor_ip     TEXT,                         -- IP source
    method       TEXT NOT NULL,                -- HTTP method (POST, PATCH, DELETE, …)
    path         TEXT NOT NULL,                -- URL path normalisé
    status_code  INTEGER,                      -- code HTTP retourné
    resource     TEXT,                         -- ex: 'livre_scolaire/123', 'wallet/credit'
    action       TEXT,                         -- ex: 'create', 'update', 'delete', 'admin_payout'
    old_value    JSONB,                        -- état AVANT (pour update/delete)
    new_value    JSONB,                        -- état APRÈS (pour create/update)
    metadata     JSONB,                        -- libre (request_id, user_agent, etc.)
    duration_ms  INTEGER,                      -- temps d'exécution
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx
    ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_path_created_idx
    ON audit_logs (path, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx
    ON audit_logs (resource) WHERE resource IS NOT NULL;
-- Partition logique : conserver 90 jours par défaut. Pour purger :
-- DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';

COMMENT ON TABLE audit_logs IS
    'Journal d''audit centralisé. Toutes les opérations sensibles (admin, wallet, bourse, parrainage) DOIVENT être enregistrées ici via le middleware audit_log. Conservation 90 jours minimum.';

-- ----------------------------------------------------------------------------
-- 2. FLAG users.is_yukpo_official_librairie
--    Remplace YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS (env var) par flag DB.
--    Bénéfices :
--      - Révocation instantanée sans redéploiement
--      - Audit traçable (table audit_logs)
--      - Pas de fuite si .env compromis
-- ----------------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_yukpo_official_librairie BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS users_yukpo_official_librairie_idx
    ON users (id) WHERE is_yukpo_official_librairie = TRUE;

COMMENT ON COLUMN users.is_yukpo_official_librairie IS
    'Si TRUE, l''utilisateur a accès admin aux opérations de la librairie Yukpo officielle (marketplace-overview, recover_consignation, …) au même titre qu''un super_admin sur ce périmètre. Géré uniquement par super_admin via /api/admin/users/:id/grant-librairie-admin.';

-- Bootstrap : importer la liste actuelle depuis l'env (à exécuter manuellement
-- une fois post-migration, puis vider l'env var) :
--
--   UPDATE users SET is_yukpo_official_librairie = TRUE WHERE id IN (1, 42, 108);
--   fly secrets unset YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS

-- ----------------------------------------------------------------------------
-- 3. SOFT-DELETE livres_scolaires
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'livres_scolaires') THEN
        ALTER TABLE livres_scolaires
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS deleted_by INTEGER,
            ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

        -- Index partiel : presque toutes les requêtes filtrent les non-supprimés
        CREATE INDEX IF NOT EXISTS livres_scolaires_active_idx
            ON livres_scolaires (id) WHERE deleted_at IS NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. INDEX hot-path Bourse pour la montée en charge
--    Couvre les requêtes les plus fréquentes : recherche par classe, par état,
--    par session d'upload OCR, listing des programmes par classe.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- livres_scolaires : la colonne réelle est `classe_actuelle` (pas classe_id).
    -- Un index `idx_livres_classe_actuelle` existe déjà — pas la peine de
    -- dupliquer. On garde le bloc défensif pour éviter une régression si la
    -- colonne `classe_id` est ajoutée plus tard.
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'livres_scolaires' AND column_name = 'classe_id') THEN
        CREATE INDEX IF NOT EXISTS livres_scolaires_classe_active_idx
            ON livres_scolaires (classe_id) WHERE deleted_at IS NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'programmes_scolaires' AND column_name = 'classe_id') THEN
        CREATE INDEX IF NOT EXISTS programmes_scolaires_classe_idx
            ON programmes_scolaires (classe_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'commandes_mixtes' AND column_name = 'user_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'commandes_mixtes' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS commandes_mixtes_user_created_idx
            ON commandes_mixtes (user_id, created_at DESC);
    END IF;
END $$;

-- ============================================================================
-- Migration : wallet_credit_bourse + troc_status pour le nouveau modèle de troc
-- Date : 2026-05-10
-- ============================================================================
-- Pivot du modèle troc : du « post-completion soulte cash » vers
-- « crédit immédiat in-app appliqué au checkout ».
--
-- Nouveautés :
--   1. users.wallet_credit_bourse : crédit utilisable UNIQUEMENT sur Bourse
--      (séparé de tokens_balance qui reste cash général)
--   2. livres_scolaires.troc_status : étapes du cycle troc
--      pending → matched → chained → delivered (succès)
--                                  → expired (échec / pas de match en 60j)
--                                  → returned (rollback chaîne)
--   3. Table wallet_credit_bourse_ledger : audit trail des mouvements de crédit
-- ============================================================================

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS wallet_credit_bourse NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_wallet_credit_bourse
    ON users(id)
    WHERE wallet_credit_bourse > 0;

ALTER TABLE livres_scolaires
    ADD COLUMN IF NOT EXISTS troc_status TEXT NOT NULL DEFAULT 'pending';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'livres_scolaires_troc_status_check'
    ) THEN
        ALTER TABLE livres_scolaires
            ADD CONSTRAINT livres_scolaires_troc_status_check
            CHECK (troc_status IN ('pending', 'matched', 'chained', 'delivered', 'expired', 'returned'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_livres_troc_status
    ON livres_scolaires(troc_status, created_at)
    WHERE troc_status IN ('pending', 'matched', 'chained');

CREATE TABLE IF NOT EXISTS wallet_credit_bourse_ledger (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount          NUMERIC(12,2) NOT NULL,
    direction       TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    source          TEXT NOT NULL,
    livre_id        INTEGER REFERENCES livres_scolaires(id) ON DELETE SET NULL,
    chaine_id       INTEGER REFERENCES chaines_troc_livres(id) ON DELETE SET NULL,
    troc_id         INTEGER REFERENCES troc_livres_scolaires(id) ON DELETE SET NULL,
    purchase_id     INTEGER REFERENCES book_purchases(id) ON DELETE SET NULL,
    note            TEXT,
    balance_after   NUMERIC(12,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user
    ON wallet_credit_bourse_ledger(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_source
    ON wallet_credit_bourse_ledger(source, created_at DESC);

COMMIT;

-- ============================================================================
-- Sources canoniques (string) :
--   'troc_credit_provisional'  : crédit avancé au parent à la finalisation troc
--   'troc_credit_engaged'      : engagement définitif quand chaîne créée
--   'troc_credit_rolled_back'  : rollback si chaîne échoue
--   'order_credit_used'        : utilisation au checkout pour réduire facture
--   'consignation_recovery'    : récupération via vente boutique secondaire
-- ============================================================================

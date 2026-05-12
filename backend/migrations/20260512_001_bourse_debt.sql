-- ✅ 2026-05-12 — Dette Bourse (spécifique aux rollbacks troc après usage du crédit)
--
-- La dette est INDÉPENDANTE de wallet_credit_bourse (qui reste contraint à ≥ 0
-- pour préserver l'invariant existant). Le solde effectif présenté à l'user
-- = wallet_credit_bourse − bourse_debt_xaf (peut donc être négatif).
--
-- Elle est :
--   - Créée par troc_lifecycle_service.rollback_chain() quand le crédit
--     provisional ne peut plus être consommé (déjà utilisé en commande).
--   - Apurée à la prochaine commande via clear_debt_tx (ajoutée au total
--     à payer, puis remise à 0).
--
-- Audit complet via wallet_credit_bourse_ledger (sources 'troc_rollback_debt'
-- et 'debt_repaid_via_order').

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS bourse_debt_xaf NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Empêcher dette négative (mauvaise donnée)
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_bourse_debt_xaf_non_negative;
ALTER TABLE users
    ADD CONSTRAINT users_bourse_debt_xaf_non_negative
    CHECK (bourse_debt_xaf >= 0);

-- Index pour les requêtes admin "tous les users avec dette"
CREATE INDEX IF NOT EXISTS idx_users_bourse_debt_positive
    ON users (bourse_debt_xaf) WHERE bourse_debt_xaf > 0;

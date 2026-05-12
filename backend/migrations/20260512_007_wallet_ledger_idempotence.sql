-- ============================================================================
-- ✅ 2026-05-12 — Idempotence forte du wallet_credit_bourse_ledger
--
-- Patch sécurité C2 : empêcher la double-écriture du crédit/dette troc en cas
-- de race (cron daily qui chevauche, double-clic finalize, retry réseau).
--
-- Le wallet lui-même est déjà atomique (UPDATE conditionnel WHERE
-- wallet_credit_bourse >= $2 dans consume_credit_tx). Ce qui manquait :
-- garantir qu'on n'insère qu'UNE SEULE entrée ledger par (livre_id, source)
-- pour les sources critiques. Si une 2e tentative arrive, l'INSERT échoue
-- avec SQLSTATE 23505, la transaction rollback, et le wallet reste cohérent.
--
-- Sources protégées :
--   - troc_credit_provisional : crédit avancé à la finalisation TrocPrep
--   - troc_credit_engaged     : engagement définitif (chaîne créée)
--   - troc_credit_rolled_back : rollback consommable (consume_credit)
--   - troc_rollback_debt      : rollback via dette (apply_debt_tx)
--
-- Les deux dernières sont groupées dans un seul index : peu importe le chemin
-- (consume ou debt), un seul rollback par livre est tolérable.
-- ============================================================================

BEGIN;

-- 1. Un seul crédit provisional par livre (anti double-finalize TrocPrep)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_ledger_provisional_per_livre
    ON wallet_credit_bourse_ledger(livre_id)
    WHERE source = 'troc_credit_provisional' AND livre_id IS NOT NULL;

-- 2. Un seul engagement définitif par livre (anti double-finalize_chain)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_ledger_engaged_per_livre
    ON wallet_credit_bourse_ledger(livre_id)
    WHERE source = 'troc_credit_engaged' AND livre_id IS NOT NULL;

-- 3. Un seul rollback par livre, quel que soit le chemin (consume OU debt).
--    Empêche le double-comptage de dette si le cron daily passe 2 fois sur
--    le même livre stuck.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_ledger_rollback_per_livre
    ON wallet_credit_bourse_ledger(livre_id)
    WHERE source IN ('troc_credit_rolled_back', 'troc_rollback_debt')
      AND livre_id IS NOT NULL;

COMMIT;

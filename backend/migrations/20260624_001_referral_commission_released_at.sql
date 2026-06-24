-- =============================================================================
-- Migration : ajouter `released_at` au ledger wallet pour distinguer
--             commission INITIÉE vs EFFECTIVE
-- =============================================================================
-- Date    : 2026-06-24
-- Contexte: refonte du parrainage Sprint 2. Les commissions troc/seller sont
--           créditées au moment de la création du troc (= "initiée") mais ne
--           deviennent EFFECTIVE (= retirable en cash) qu'à la confirmation
--           de la livraison effective par le coursier.
--
-- Conception :
--   * `released_at IS NULL`     → INITIÉE (visible dans le wallet, bloquée
--                                 pour cash-out)
--   * `released_at IS NOT NULL` → EFFECTIVE (retirable en cash)
--
--   La balance affichée dans le dashboard parrain reste la somme totale
--   (initiée + effective) pour la transparence. Le payout, lui, ne peut
--   être déclenché QUE sur la part effective (gate côté wallet_payout_service).
--
-- Idempotence : ADD COLUMN IF NOT EXISTS. Backfill marqué via flag colonne
-- pour éviter de re-jouer si la migration repasse.
-- =============================================================================

ALTER TABLE wallet_credit_bourse_ledger
    ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

-- Index partiel : seulement les entrées NON-released (= initiées, à traiter
-- au moment des hooks de livraison). Économise espace + speed-up updates.
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_pending_release
    ON wallet_credit_bourse_ledger (livre_id, source)
    WHERE released_at IS NULL
      AND source IN ('referral_troc_commission', 'referral_seller_commission');

-- Index pour la requête de balance effective (cash-out gate).
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_released_user
    ON wallet_credit_bourse_ledger (user_id, released_at)
    WHERE source LIKE 'referral_%';

-- =============================================================================
-- BACKFILL : marquer toutes les entrées EXISTANTES comme effective.
-- =============================================================================
-- Rationale : avant cette migration, le système ne distinguait pas. Toutes
-- les commissions déjà créditées sont donc considérées comme "validées"
-- (rétrocompatibilité). Seules les NOUVELLES entrées (post-migration)
-- adopteront le modèle 2 phases.
--
-- Conditions :
--   * Filtre sur les sources de parrainage (pas de bonus, troc, seller)
--   * Filtre direction='credit' (les debits = payouts ne sont pas concernés)
--   * NULLIF pour idempotence : si released_at est déjà set par un retry,
--     on ne le réécrit pas.
UPDATE wallet_credit_bourse_ledger
   SET released_at = created_at
 WHERE released_at IS NULL
   AND direction = 'credit'
   AND source IN ('referral_bonus', 'referral_troc_commission', 'referral_seller_commission')
   AND created_at < NOW() - INTERVAL '1 minute';
   -- Buffer 1 min : protège contre les race-conditions au moment du déploiement
   -- (entrées toutes fraîches qui ne devraient PAS être backfillées).

-- Vérification
DO $$
DECLARE
    nb_released INTEGER;
    nb_pending  INTEGER;
BEGIN
    SELECT COUNT(*) INTO nb_released
      FROM wallet_credit_bourse_ledger
     WHERE source LIKE 'referral_%' AND direction = 'credit' AND released_at IS NOT NULL;
    SELECT COUNT(*) INTO nb_pending
      FROM wallet_credit_bourse_ledger
     WHERE source LIKE 'referral_%' AND direction = 'credit' AND released_at IS NULL;
    RAISE NOTICE '[referral_released_at] released=%, pending=%', nb_released, nb_pending;
END $$;

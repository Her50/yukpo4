-- ============================================================================
-- 2026-05-15 : Système de parrainage Yukpo — PR #2 (conversion)
--
-- - Corrige le type de referrals.first_order_id : INTEGER → UUID (deliveries.id)
-- - Ajoute first_order_total_xaf pour audit (combien valait la commande qui a
--   déclenché le bonus). Permet de vérifier rétroactivement le respect du seuil.
-- ============================================================================

DO $$
BEGIN
    -- Drop ancien INTEGER first_order_id (créé en PR #1 par erreur sur le type)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'referrals'
          AND column_name = 'first_order_id'
          AND data_type = 'integer'
    ) THEN
        ALTER TABLE referrals DROP COLUMN first_order_id;
    END IF;
END $$;

ALTER TABLE referrals
    ADD COLUMN IF NOT EXISTS first_order_id UUID,
    ADD COLUMN IF NOT EXISTS first_order_total_xaf INTEGER;

-- Anti-double-crédit : un seul order par parrainage peut servir de déclencheur.
-- (En théorie redondant avec bonus_credited_at IS NOT NULL, mais ceinture
-- et bretelles.)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_referrals_first_order
    ON referrals(first_order_id)
    WHERE first_order_id IS NOT NULL;

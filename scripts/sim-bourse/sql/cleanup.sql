-- =============================================================================
-- CLEANUP simulation Bourse du Livre
-- =============================================================================
-- Purge toutes les données de simulation. Préserve :
--   - schéma Postgres
--   - référentiel programmes_scolaires (au cas où on relance une 2e passe)
--   - _sqlx_migrations
--
-- TRUNCATE plutôt que DELETE pour speed + reset des SEQUENCE.
-- CASCADE pour traverser les FK.
-- RESTART IDENTITY pour repartir id=1.
-- =============================================================================

BEGIN;

-- 1) Tables Bourse du Livre (FK chain : trocs/chaines/packages → livres → users)
TRUNCATE TABLE
    wallet_credit_bourse_ledger,
    book_exchange_commissions,
    book_purchases,
    book_delivery_packages,
    chaines_troc_livres,
    troc_livres_scolaires,
    livre_scolaire_demandes,
    livres_scolaires,
    book_upload_sessions
RESTART IDENTITY CASCADE;

-- 2) Parrainage
TRUNCATE TABLE
    referral_clicks,
    referrals
RESTART IDENTITY CASCADE;

-- 3) Wallet payout (si table existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_payout_requests') THEN
        TRUNCATE TABLE wallet_payout_requests RESTART IDENTITY CASCADE;
    END IF;
END $$;

-- 4) Établissements/services créés par la sim (filtrés par tag de simulation
--    pour ne PAS toucher d'éventuels services réels seedés via migrations)
DELETE FROM etablissements_scolaires
WHERE nom_etablissement LIKE 'SIM-BOURSE-%';

-- 5) Users de simulation (email = sim+XXX@yukpo-sim.local).
--    ON DELETE CASCADE propage sur user_documents, etc.
DELETE FROM users
WHERE email LIKE 'sim+%@yukpo-sim.local';

-- 6) Services de simulation créés par 01-seed.js (1 par parent vendeur,
--    tag dans data->>'sim_tag' = 'SIM-BOURSE', category = 'bourse-livre').
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'services') THEN
        DELETE FROM services
        WHERE category = 'bourse-livre'
          AND data->>'sim_tag' = 'SIM-BOURSE';
    END IF;
END $$;

COMMIT;

-- =============================================================================
-- VÉRIFICATION : doit retourner 0 partout (sauf programmes_scolaires intacts)
-- =============================================================================
SELECT 'users_sim'              AS table_name, COUNT(*) AS n FROM users WHERE email LIKE 'sim+%@yukpo-sim.local'
UNION ALL SELECT 'livres_scolaires',           COUNT(*) FROM livres_scolaires
UNION ALL SELECT 'livre_scolaire_demandes',    COUNT(*) FROM livre_scolaire_demandes
UNION ALL SELECT 'troc_livres_scolaires',      COUNT(*) FROM troc_livres_scolaires
UNION ALL SELECT 'chaines_troc_livres',        COUNT(*) FROM chaines_troc_livres
UNION ALL SELECT 'book_delivery_packages',     COUNT(*) FROM book_delivery_packages
UNION ALL SELECT 'book_purchases',             COUNT(*) FROM book_purchases
UNION ALL SELECT 'book_exchange_commissions',  COUNT(*) FROM book_exchange_commissions
UNION ALL SELECT 'wallet_credit_bourse_ledger',COUNT(*) FROM wallet_credit_bourse_ledger
UNION ALL SELECT 'referrals',                  COUNT(*) FROM referrals
UNION ALL SELECT 'referral_clicks',            COUNT(*) FROM referral_clicks
UNION ALL SELECT 'programmes_scolaires (intact)', COUNT(*) FROM programmes_scolaires;

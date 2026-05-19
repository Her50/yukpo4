-- =============================================================================
-- PRE-TRUNCATE — purge initiale du clone Postgres staging avant simulation
-- =============================================================================
-- Vide TOUTES les tables Bourse du Livre + parrainage du clone de prod.
-- Tolère l'absence de certaines tables (le backend les créera via auto-migrate).
-- Préserve : users, programmes_scolaires, services, etablissements_scolaires.
-- =============================================================================

DO $$
DECLARE
    t TEXT;
    tables_to_clear TEXT[] := ARRAY[
        'wallet_credit_bourse_ledger',
        'book_exchange_commissions',
        'book_purchases',
        'book_delivery_packages',
        'chaines_troc_livres',
        'troc_livres_scolaires',
        'livre_scolaire_demandes',
        'livres_scolaires',
        'book_upload_sessions',
        'referral_clicks',
        'referrals',
        'wallet_payout_requests',
        'book_donation_requests',
        -- ✅ FIX 2026-05-18 — purge aussi les commandes mixtes / transactions
        -- pour éviter les FK orphelines lors du DELETE des users sim+.
        'transactions_agregees',
        'commande_livres_occasion',
        'commande_livres_neufs',
        'commande_validations',
        'commandes_mixtes',
        -- libraire_team_members référence users — purger d'abord
        'libraire_team_members',
        'librairie_partners'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_clear LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', t);
            RAISE NOTICE 'TRUNCATEd %', t;
        ELSE
            RAISE NOTICE 'Skipped (table absente) : %', t;
        END IF;
    END LOOP;
END $$;

-- ✅ FIX 2026-05-18 — purge des comptes sim+%@yukpo-sim.local pour
-- permettre au seed de les recréer (sinon "Key (email) already exists"
-- → seed crashe AVANT d'insérer les livres → simulation tourne à vide).
-- Les comptes RÉELS de prod (autres emails) ne sont JAMAIS touchés.
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM services WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'sim+%@yukpo-sim.local');
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Services sim purgés : %', deleted_count;
    DELETE FROM users WHERE email LIKE 'sim+%@yukpo-sim.local';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Users sim purgés : %', deleted_count;
END $$;

-- Reset soldes wallet
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'users' AND column_name = 'wallet_credit_bourse') THEN
        UPDATE users SET wallet_credit_bourse = 0 WHERE wallet_credit_bourse <> 0;
    END IF;
END $$;

-- Vérification finale
SELECT 'programmes_scolaires (intact)' AS info, COUNT(*) AS n FROM programmes_scolaires
UNION ALL SELECT 'users (intact)',          COUNT(*) FROM users
UNION ALL SELECT 'livres_scolaires (vide)', COUNT(*) FROM livres_scolaires
UNION ALL SELECT 'troc_livres_scolaires',   COUNT(*) FROM troc_livres_scolaires
UNION ALL SELECT 'book_delivery_packages',  COUNT(*) FROM book_delivery_packages
UNION ALL SELECT 'referrals',               COUNT(*) FROM referrals;

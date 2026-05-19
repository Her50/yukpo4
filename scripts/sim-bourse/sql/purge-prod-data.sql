-- =============================================================================
-- PURGE PRE-SEED : nettoyage des données réelles importées dans le fork
-- =============================================================================
-- À exécuter UNE FOIS sur la DB staging (yukpo_db) AVANT 01-seed.js.
-- Supprime tous les users réels + livres + commandes + parrainages du clone,
-- MAIS préserve :
--   - programmes_scolaires (référentiel national, ~784 entrées)
--   - schéma + migrations
--   - tables système (auth, partner_type ...)
--
-- ⚠️ NE PAS exécuter sur la prod (yukpo-fly-postgres). Garde-fou : la query
-- finale assert que la DB est bien le fork (current_database() = yukpo_db
-- ET hostname contient 'sim').
-- =============================================================================

BEGIN;

-- Tables Bourse : ordre topologique (FK leaves first)
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

TRUNCATE TABLE
    referral_clicks,
    referrals
RESTART IDENTITY CASCADE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_payout_requests') THEN
        EXECUTE 'TRUNCATE TABLE wallet_payout_requests RESTART IDENTITY CASCADE';
    END IF;
END $$;

-- Sessions / services / chats / ratings (tout ce qui dépend des users prod)
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'services','chat_messages','chat_conversations','notifications',
        'user_documents','phone_verifications','payment_methods_users',
        'whatsapp_messages','user_sessions','user_devices'
    ] LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
            EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', t);
        END IF;
    END LOOP;
END $$;

-- Users (CASCADE va propager sur tout ce qui en dépend encore)
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

COMMIT;

-- =============================================================================
-- VÉRIFICATION : référentiel intact, données purgées
-- =============================================================================
SELECT 'programmes_scolaires (doit rester intact)' AS verif, COUNT(*) AS n FROM programmes_scolaires
UNION ALL SELECT 'users (doit = 0)',          COUNT(*) FROM users
UNION ALL SELECT 'livres_scolaires (doit = 0)', COUNT(*) FROM livres_scolaires
UNION ALL SELECT 'troc_livres_scolaires (doit = 0)', COUNT(*) FROM troc_livres_scolaires
UNION ALL SELECT 'book_delivery_packages (doit = 0)', COUNT(*) FROM book_delivery_packages
UNION ALL SELECT 'referrals (doit = 0)', COUNT(*) FROM referrals;

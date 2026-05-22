-- =============================================================================
-- CLEANUP PROD — Bourse du Livre / Yukpo Librairie
-- =============================================================================
-- Vide UNIQUEMENT les données transactionnelles générées par les utilisateurs
-- en testant en prod (commandes, trocs, annonces vente/occasion, scans
-- d'inventaire, mouvements wallet bourse).
--
-- ⚠️  À NE PAS CONFONDRE — distinction des deux tables 'livres' :
--
--   • programmes_scolaires (PRÉSERVÉE)
--       Référentiel officiel livres par classe MINEDUC/MINESEC :
--       pays / classe / matiere / titre_livre / auteur / editeur / ISBN /
--       prix_officiel. C'est le seed scolaire qu'on NE TOUCHE PAS.
--
--   • livres_scolaires (TRUNCATE)
--       Annonces utilisateurs (FK user_id) : livres mis en vente occasion ou
--       proposés au troc, avec état/photos/GPS. Données de transaction.
--
-- Préservés : users, librairie_partners, libraire_team_members,
-- programmes_scolaires, services, etablissements_scolaires, referrals.
--
-- ⚠️  PROD — opération destructive. Exécuter dans un transaction wrapper :
--
--     fly proxy 15432:5432 -a <db-app-prod>
--     psql -h localhost -p 15432 -U <user> -d <db> \
--          -v ON_ERROR_STOP=1 -f scripts/cleanup-prod-bourse-data.sql
--
-- Le script s'exécute en transaction. Par défaut il termine par ROLLBACK
-- (mode dry-run : on voit les comptes avant/après). Pour valider :
-- remplacer la dernière ligne `ROLLBACK;` par `COMMIT;` puis relancer.
-- =============================================================================

\timing on

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Tables d'inventaire : on construit dynamiquement la liste des comptes
--    pour tolérer les tables absentes (la prod n'a pas exactement le même
--    schéma que la sim, certaines tables peuvent ne pas exister).
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS _cleanup_counts;
CREATE TEMP TABLE _cleanup_counts (
    phase TEXT,
    t TEXT,
    n BIGINT
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.count_if_exists(p_phase TEXT, p_table TEXT)
RETURNS VOID AS $$
DECLARE
    cnt BIGINT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = p_table
    ) THEN
        EXECUTE format('SELECT COUNT(*) FROM %I', p_table) INTO cnt;
        INSERT INTO _cleanup_counts(phase, t, n) VALUES (p_phase, p_table, cnt);
    ELSE
        INSERT INTO _cleanup_counts(phase, t, n) VALUES (p_phase, p_table || ' (absent)', NULL);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Comptes AVANT
-- ─────────────────────────────────────────────────────────────────────────────

SELECT pg_temp.count_if_exists('AVANT', 'commandes_mixtes');
SELECT pg_temp.count_if_exists('AVANT', 'commande_livres_neufs');
SELECT pg_temp.count_if_exists('AVANT', 'commande_livres_occasion');
SELECT pg_temp.count_if_exists('AVANT', 'commande_validations');
SELECT pg_temp.count_if_exists('AVANT', 'notifications_librairie');
SELECT pg_temp.count_if_exists('AVANT', 'transactions_agregees');
SELECT pg_temp.count_if_exists('AVANT', 'livres_scolaires');
SELECT pg_temp.count_if_exists('AVANT', 'troc_livres_scolaires');
SELECT pg_temp.count_if_exists('AVANT', 'chaines_troc_livres');
SELECT pg_temp.count_if_exists('AVANT', 'book_purchases');
SELECT pg_temp.count_if_exists('AVANT', 'book_delivery_packages');
SELECT pg_temp.count_if_exists('AVANT', 'book_upload_sessions');
SELECT pg_temp.count_if_exists('AVANT', 'book_donation_requests');
SELECT pg_temp.count_if_exists('AVANT', 'book_exchange_commissions');
SELECT pg_temp.count_if_exists('AVANT', 'wallet_credit_bourse_ledger');
SELECT pg_temp.count_if_exists('AVANT', 'livre_scolaire_demandes');
SELECT pg_temp.count_if_exists('AVANT', 'book_exchanges');
SELECT pg_temp.count_if_exists('AVANT', 'book_recommendations');
SELECT pg_temp.count_if_exists('AVANT', 'book_price_history');
SELECT pg_temp.count_if_exists('AVANT', 'book_analytics');
SELECT pg_temp.count_if_exists('AVANT', 'book_cancellation_log');
SELECT pg_temp.count_if_exists('AVANT (préservé)', 'users');
SELECT pg_temp.count_if_exists('AVANT (préservé)', 'librairie_partners');
SELECT pg_temp.count_if_exists('AVANT (préservé)', 'programmes_scolaires');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) TRUNCATE — données transactionnelles uniquement
--    L'ordre est important pour respecter les FK même si CASCADE est utilisé.
--    Tables absentes en prod : tolérées via le test information_schema.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    t TEXT;
    tables_to_clear TEXT[] := ARRAY[
        -- 1. Mouvements financiers liés à la bourse
        'wallet_credit_bourse_ledger',
        'book_exchange_commissions',

        -- 2. Achats / trocs / commissions
        'book_purchases',
        'book_delivery_packages',
        'chaines_troc_livres',
        'troc_livres_scolaires',
        'livre_scolaire_demandes',

        -- 3. Articles utilisateurs (vente occasion + scans inventaire)
        'livres_scolaires',
        'book_upload_sessions',
        'book_donation_requests',

        -- 4. Pipeline commandes Yukpo Librairie
        'transactions_agregees',
        'notifications_librairie',
        'commande_livres_occasion',
        'commande_livres_neufs',
        'commande_validations',
        'commandes_mixtes',

        -- 5. Tables avancées (analytics/recommandations/prix) liées aux livres
        'book_recommendations',
        'book_price_history',
        'book_analytics',
        'book_exchanges',
        'book_cancellation_log'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_clear LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', t);
            RAISE NOTICE 'TRUNCATEd %', t;
        ELSE
            RAISE NOTICE 'Skipped (table absente en prod) : %', t;
        END IF;
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Reset solde wallet_credit_bourse côté users (sans toucher au compte)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'wallet_credit_bourse'
    ) THEN
        UPDATE users SET wallet_credit_bourse = 0 WHERE wallet_credit_bourse <> 0;
        RAISE NOTICE 'Wallet bourse remis à 0';
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Comptes APRÈS
-- ─────────────────────────────────────────────────────────────────────────────

SELECT pg_temp.count_if_exists('APRÈS', 'commandes_mixtes');
SELECT pg_temp.count_if_exists('APRÈS', 'commande_livres_neufs');
SELECT pg_temp.count_if_exists('APRÈS', 'commande_livres_occasion');
SELECT pg_temp.count_if_exists('APRÈS', 'commande_validations');
SELECT pg_temp.count_if_exists('APRÈS', 'notifications_librairie');
SELECT pg_temp.count_if_exists('APRÈS', 'transactions_agregees');
SELECT pg_temp.count_if_exists('APRÈS', 'livres_scolaires');
SELECT pg_temp.count_if_exists('APRÈS', 'troc_livres_scolaires');
SELECT pg_temp.count_if_exists('APRÈS', 'chaines_troc_livres');
SELECT pg_temp.count_if_exists('APRÈS', 'book_purchases');
SELECT pg_temp.count_if_exists('APRÈS', 'book_delivery_packages');
SELECT pg_temp.count_if_exists('APRÈS', 'book_upload_sessions');
SELECT pg_temp.count_if_exists('APRÈS', 'book_donation_requests');
SELECT pg_temp.count_if_exists('APRÈS', 'book_exchange_commissions');
SELECT pg_temp.count_if_exists('APRÈS', 'wallet_credit_bourse_ledger');
SELECT pg_temp.count_if_exists('APRÈS', 'livre_scolaire_demandes');
SELECT pg_temp.count_if_exists('APRÈS', 'book_exchanges');
SELECT pg_temp.count_if_exists('APRÈS', 'book_recommendations');
SELECT pg_temp.count_if_exists('APRÈS', 'book_price_history');
SELECT pg_temp.count_if_exists('APRÈS', 'book_analytics');
SELECT pg_temp.count_if_exists('APRÈS', 'book_cancellation_log');
SELECT pg_temp.count_if_exists('APRÈS (préservé)', 'users');
SELECT pg_temp.count_if_exists('APRÈS (préservé)', 'librairie_partners');
SELECT pg_temp.count_if_exists('APRÈS (préservé)', 'programmes_scolaires');

-- Tableau récapitulatif final
SELECT phase, t, n FROM _cleanup_counts ORDER BY phase, t;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Mode dry-run par défaut. Pour valider, remplacer ROLLBACK par COMMIT.
-- ─────────────────────────────────────────────────────────────────────────────

COMMIT;  -- ⚠️  2026-05-22 — validé après dry-run sur prod (4 commandes, 192 lignes neufs, 211 annonces, 10 scans).

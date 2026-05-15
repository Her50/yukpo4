-- ============================================================================
-- WIPE COMPLET DES DONNÉES DE SIMULATION — BOURSE DU LIVRE
-- ============================================================================
-- Vide la table principale `livres_scolaires` et toutes les tables
-- dépendantes via CASCADE. Ne touche PAS aux référentiels (programmes_scolaires,
-- accessoires_populaires_par_classe, etablissements_scolaires).
--
-- Tables wipées :
--   - livres_scolaires (principale)
--   - book_exchange_commissions (livre_id FK CASCADE)
--   - book_donation_requests (livre_id FK CASCADE)
--   - book_purchases (livre_id FK CASCADE)
--   - troc_livres_scolaires (livre_offert_id + livre_souhaite_id FK CASCADE)
--   - chaines_troc_livres (livre_scolaire_id FK CASCADE)
--   - book_upload_sessions (les sessions orphelines de scan, sans FK directe)
--   - book_delivery_packages (les packages de livraison liés aux livres)
--   - book_cancellation_log (log d'annulations)
--
-- Le RESTART IDENTITY remet les séquences à 1 (id reprend à 1 après wipe).
--
-- ⚠️ DESTRUCTIF — affecte tous les utilisateurs sur cette base.
-- À exécuter via : flyctl postgres connect -a <db-app> ou flyctl proxy + psql.
-- ============================================================================

BEGIN;

-- 1) Comptage AVANT pour traçabilité
\echo '=== Comptage AVANT wipe ==='
SELECT 'livres_scolaires' AS table_name, COUNT(*) AS rows FROM livres_scolaires
UNION ALL SELECT 'book_exchange_commissions', COUNT(*) FROM book_exchange_commissions
UNION ALL SELECT 'book_donation_requests', COUNT(*) FROM book_donation_requests
UNION ALL SELECT 'book_purchases', COUNT(*) FROM book_purchases
UNION ALL SELECT 'troc_livres_scolaires', COUNT(*) FROM troc_livres_scolaires
UNION ALL SELECT 'chaines_troc_livres', COUNT(*) FROM chaines_troc_livres
UNION ALL SELECT 'book_upload_sessions', COUNT(*) FROM book_upload_sessions
UNION ALL SELECT 'book_delivery_packages', COUNT(*) FROM book_delivery_packages
UNION ALL SELECT 'book_cancellation_log', COUNT(*) FROM book_cancellation_log;

-- 2) Wipe principal — l'ordre n'importe pas car CASCADE gère les FK
TRUNCATE TABLE
    livres_scolaires,
    book_exchange_commissions,
    book_donation_requests,
    book_purchases,
    troc_livres_scolaires,
    chaines_troc_livres,
    book_upload_sessions,
    book_delivery_packages,
    book_cancellation_log
RESTART IDENTITY CASCADE;

-- 3) Comptage APRÈS pour confirmation
\echo '=== Comptage APRÈS wipe ==='
SELECT 'livres_scolaires' AS table_name, COUNT(*) AS rows FROM livres_scolaires
UNION ALL SELECT 'book_exchange_commissions', COUNT(*) FROM book_exchange_commissions
UNION ALL SELECT 'book_donation_requests', COUNT(*) FROM book_donation_requests
UNION ALL SELECT 'book_purchases', COUNT(*) FROM book_purchases
UNION ALL SELECT 'troc_livres_scolaires', COUNT(*) FROM troc_livres_scolaires
UNION ALL SELECT 'chaines_troc_livres', COUNT(*) FROM chaines_troc_livres
UNION ALL SELECT 'book_upload_sessions', COUNT(*) FROM book_upload_sessions
UNION ALL SELECT 'book_delivery_packages', COUNT(*) FROM book_delivery_packages
UNION ALL SELECT 'book_cancellation_log', COUNT(*) FROM book_cancellation_log;

COMMIT;

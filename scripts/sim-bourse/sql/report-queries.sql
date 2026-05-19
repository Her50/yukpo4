-- =============================================================================
-- report-queries.sql V2 — agrégats pour 03-report.js
-- =============================================================================

-- Query 1 : Couverture matching livres troc
SELECT
    COUNT(*)::int AS total_livres,
    COUNT(*) FILTER (WHERE troc_status = 'pending')::int   AS pending,
    COUNT(*) FILTER (WHERE troc_status = 'matched')::int   AS matched,
    COUNT(*) FILTER (WHERE troc_status = 'chained')::int   AS chained,
    COUNT(*) FILTER (WHERE troc_status = 'delivered')::int AS delivered,
    COUNT(*) FILTER (WHERE offre_matchee = true)::int      AS offres_matchees
FROM livres_scolaires
WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'sim+%@yukpo-sim.local');

-- Query 2 : Répartition mode listing
SELECT mode_listing, COUNT(*)::int AS n
FROM livres_scolaires
WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'sim+%@yukpo-sim.local')
GROUP BY mode_listing ORDER BY 2 DESC;

-- Query 3 : Concentration villes (livres)
SELECT ville, COUNT(*)::int AS livres, COUNT(DISTINCT user_id)::int AS users
FROM livres_scolaires
WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'sim+%@yukpo-sim.local')
GROUP BY ville ORDER BY 2 DESC LIMIT 10;

-- Query 4 : Trocs & chaînes créés (IA matching)
SELECT
    (SELECT COUNT(*)::int FROM troc_livres_scolaires)  AS trocs_total,
    (SELECT COUNT(*)::int FROM chaines_troc_livres)    AS chaines_total,
    (SELECT COALESCE(AVG(jsonb_array_length(participants))::float, 0) FROM chaines_troc_livres) AS taille_moyenne_chaine,
    (SELECT COUNT(*)::int FROM chaines_troc_livres WHERE statut='completee') AS chaines_completees;

-- Query 5 : Paquets coursier
SELECT statut, COUNT(*)::int AS n,
       COALESCE(AVG(nombre_livres)::float, 0) AS livres_par_paquet,
       COALESCE(SUM(valeur_totale)::float, 0) AS valeur_totale_xaf
FROM book_delivery_packages
GROUP BY statut ORDER BY 1;

-- Query 6 : Achats simples (book_purchases — bourse_livre direct)
SELECT
    COUNT(*)::int AS commandes_total,
    COALESCE(SUM(prix_achat)::float, 0)      AS ca_brut_xaf,
    COALESCE(SUM(commission_app)::float, 0)  AS commissions_xaf,
    COALESCE(SUM(montant_vendeur)::float, 0) AS reversement_vendeurs_xaf
FROM book_purchases;

-- Query 7 : Parrainage
SELECT COUNT(*)::int AS referrals_total,
       COUNT(*) FILTER (WHERE status='converted')::int AS referrals_convertis,
       COALESCE(SUM(bonus_amount_xaf) FILTER (WHERE bonus_credited_at IS NOT NULL), 0)::float AS bonus_credites_xaf
FROM referrals;

-- Query 8 : Wallet credit bourse (dette outstanding sim)
SELECT COALESCE(SUM(wallet_credit_bourse), 0)::float AS total_credit_outstanding_xaf
FROM users WHERE email LIKE 'sim+%@yukpo-sim.local';

-- Query 9 : Commandes mixtes (librairie_network)
SELECT statut, COUNT(*)::int AS n,
       COALESCE(SUM(budget_total)::float, 0) AS budget_total_xaf,
       COALESCE(SUM(commission_app)::float, 0) AS commission_app_xaf,
       COALESCE(SUM(montant_net_libraires)::float, 0) AS net_libraires_xaf
FROM commandes_mixtes
GROUP BY statut ORDER BY 2 DESC;

-- Query 10 : Bon de commande grossiste (agrégation manuels + cahiers)
SELECT cln.titre, cln.classe, cln.matiere,
       SUM(cln.quantite)::int AS qty_total,
       COUNT(DISTINCT cln.commande_id)::int AS commandes,
       AVG(cln.prix_final)::float AS prix_moyen
FROM commande_livres_neufs cln
JOIN commandes_mixtes cm ON cm.id = cln.commande_id
WHERE cm.statut IN ('validee_complete', 'validee_partielle', 'en_preparation', 'en_livraison')
GROUP BY cln.titre, cln.classe, cln.matiere
ORDER BY qty_total DESC LIMIT 20;

-- Query 11 : Validation libraire compétitive
SELECT
    COUNT(*)::int AS validations_total,
    COUNT(DISTINCT librairie_id)::int AS libraires_actifs,
    COUNT(*) FILTER (WHERE statut='valide_complet')::int AS valide_complet,
    COUNT(*) FILTER (WHERE statut='valide_partiel')::int AS valide_partiel,
    COUNT(*) FILTER (WHERE statut='abandonne')::int AS abandonne,
    COUNT(*) FILTER (WHERE verrou_exclusif=true)::int AS verrous,
    COALESCE(AVG(EXTRACT(EPOCH FROM (timestamp_fin - timestamp_debut)))::float, 0) AS duree_moyenne_sec
FROM commande_validations;

-- Query 12 : Paiements agrégés
SELECT methode_paiement, statut, COUNT(*)::int AS n,
       COALESCE(SUM(montant_total)::float, 0) AS volume_xaf,
       COALESCE(SUM(commission_app)::float, 0) AS commission_xaf
FROM transactions_agregees
GROUP BY methode_paiement, statut
ORDER BY methode_paiement, statut;

-- Query 13 : Top vendeurs occasion (commande_livres_occasion)
SELECT u.email, COUNT(clo.id)::int AS ventes,
       COALESCE(SUM(clo.prix), 0)::float AS revenu_xaf
FROM users u
LEFT JOIN commande_livres_occasion clo ON clo.vendeur_id = u.id
WHERE u.email LIKE 'sim+%@yukpo-sim.local'
GROUP BY u.email HAVING COUNT(clo.id) > 0
ORDER BY 3 DESC NULLS LAST LIMIT 10;

-- Query 14 : Performance libraires
SELECT lp.nom, lp.ville, lp.est_super_librairie,
       COUNT(cv.id)::int AS validations,
       COUNT(cv.id) FILTER (WHERE cv.statut IN ('valide_complet','valide_partiel'))::int AS validations_reussies
FROM librairie_partners lp
LEFT JOIN commande_validations cv ON cv.librairie_id = lp.id
WHERE lp.email LIKE '%@yukpo-sim.local' OR lp.est_super_librairie = true
GROUP BY lp.id, lp.nom, lp.ville, lp.est_super_librairie
ORDER BY validations DESC LIMIT 15;

-- Query 15 : Chaînes livraison unifiées (librairie_network)
SELECT statut, COUNT(*)::int AS n,
       COALESCE(AVG(distance_totale_km), 0)::float AS distance_moy_km,
       COALESCE(AVG(duree_estimee_minutes), 0)::float AS duree_moy_min
FROM chaines_livraison_unifiees
GROUP BY statut ORDER BY 2 DESC;

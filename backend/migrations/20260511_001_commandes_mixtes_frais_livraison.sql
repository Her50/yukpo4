-- ============================================================================
-- Migration 20260511_001 : ajoute frais_livraison à commandes_mixtes
-- ============================================================================
-- Forfait fixe payé par le parent à la finalisation d'une commande mixte
-- (livres + fournitures). Ce montant inclut la collecte des éventuels livres
-- de troc. Il est ensuite redistribué :
--   - une part coursier (par défaut 80 % via YUKPO_DELIVERY_COMMISSION_RATE)
--   - une part Yukpo (commission plateforme)
-- ============================================================================

ALTER TABLE commandes_mixtes
    ADD COLUMN IF NOT EXISTS frais_livraison NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN commandes_mixtes.frais_livraison IS
    'Forfait de livraison payé par le parent (1000 FCFA par défaut). S''ajoute à budget_total. Redistribué entre coursier et plateforme à la livraison.';

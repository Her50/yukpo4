-- Migration: Harmonisation taux commission bourse du livre à 5%
-- Date: 2026-04-01
-- Description: La table book_exchange_commissions avait un DEFAULT de 10%
--              alors que toute la logique applicative applique 5%.
--              Correction du DEFAULT et des lignes existantes en attente.

-- 1. Corriger le DEFAULT de la colonne
ALTER TABLE book_exchange_commissions
    ALTER COLUMN taux_commission SET DEFAULT 0.05;

-- 2. Corriger les lignes existantes à 10% non encore reversées
--    (reversement_statut = 'en_attente' → encore modifiables sans impact financier)
UPDATE book_exchange_commissions
SET
    taux_commission        = 0.05,
    montant_commission     = ROUND(valeur_livre * 0.05, 2),
    montant_reversement_vendeur = ROUND(valeur_livre * 0.95, 2)
WHERE
    taux_commission = 0.10
    AND reversement_statut = 'en_attente';

-- 3. Vérifier la contrainte dans librairie_partners (déjà à 0.0500 dans le schema)
-- commission_app DECIMAL(5,4) NOT NULL DEFAULT 0.0500 — OK, pas de changement nécessaire

COMMENT ON COLUMN book_exchange_commissions.taux_commission IS 'Taux commission Yukpo : 5% (0.05) — corrigé depuis 10% initial';

-- Migration: désactiver le timeout fallback de Yukpo Librairie
-- Date: 2026-05-18
--
-- Décision business : Yukpo Librairie a la priorité PERMANENTE sur les
-- commandes routées vers elle. Plus de fallback automatique aux librairies
-- proches après 15 min. Yukpo gère à son rythme.
--
-- Mécanique :
--   - super_librairie_timeout_worker filtre `WHERE super_librairie_timeout_at IS NOT NULL`
--   - donc on met NULL → le worker skip ces commandes → pas de fallback auto
--
-- Effet attendu :
--   - Commandes existantes en 'envoyee_super_librairie' avec timeout futur :
--     timeout supprimé, restent chez Yukpo indéfiniment
--   - Commandes en 'envoyee_super_librairie' déjà passées en fallback
--     (super_librairie_fallback_at non NULL) : on ne touche pas, leur
--     workflow continue chez les librairies proches

UPDATE commandes_mixtes
   SET super_librairie_timeout_at = NULL
 WHERE statut = 'envoyee_super_librairie'
   AND super_librairie_fallback_at IS NULL
   AND super_librairie_timeout_at IS NOT NULL;

-- Aussi : ramener à 'envoyee_super_librairie' les commandes qui avaient
-- déjà fallback alors qu'on aurait préféré Yukpo. ⚠️ NON appliqué ici car
-- risque de doublonner les notifications déjà envoyées aux librairies
-- proches. À gérer manuellement par admin si nécessaire.

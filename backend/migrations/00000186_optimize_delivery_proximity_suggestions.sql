-- ============================================================================
-- Migration: Optimisation requête delivery_proximity_suggestions
-- Date: 2026-02-18
-- Problème: Requête prend 1.1s (seuil d'alerte: 1s)
-- Solution: Créer un index partiel optimisé pour la requête exacte
-- ============================================================================

-- ✅ Requête lente identifiée:
-- SELECT delivery_id, suggested_status, created_at, auto_confirm_after_seconds
-- FROM delivery_proximity_suggestions
-- WHERE status = 'pending'
--   AND auto_confirm_after_seconds IS NOT NULL
--   AND created_at + (auto_confirm_after_seconds || ' seconds')::interval <= NOW()
-- LIMIT 50

-- ✅ NOUVEAU: Index partiel optimisé pour la requête exacte
-- L'index couvre:
-- 1. status = 'pending' (filtre WHERE)
-- 2. auto_confirm_after_seconds IS NOT NULL (filtre WHERE)
-- 3. created_at (utilisé dans le calcul de l'intervalle)
-- L'ordre des colonnes est optimisé pour la requête
CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_auto_confirm_optimized
ON delivery_proximity_suggestions (status, created_at, auto_confirm_after_seconds)
WHERE status = 'pending' AND auto_confirm_after_seconds IS NOT NULL;

-- ✅ NOUVEAU: Index pour accélérer les mises à jour de status
CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_status_updated
ON delivery_proximity_suggestions(status, created_at DESC)
WHERE status IN ('pending', 'confirmed', 'auto_confirmed');

-- ✅ Analyser la table pour mettre à jour les statistiques du planificateur
ANALYZE delivery_proximity_suggestions;

-- Commentaire
COMMENT ON INDEX idx_delivery_proximity_suggestions_auto_confirm_optimized IS 
'Index partiel optimisé pour la requête de sélection des suggestions expirées (status=pending, auto_confirm_after_seconds IS NOT NULL)';

COMMENT ON INDEX idx_delivery_proximity_suggestions_status_updated IS 
'Index pour les mises à jour de status - optimise les requêtes de monitoring';


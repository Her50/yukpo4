-- Migration pour optimiser la requête sur delivery_matching_queue
-- Date: 2025-12-12
-- Problème: Requête lente (1-1.4s) sur delivery_matching_queue
-- Solution: Créer un index composite optimisé pour la requête exacte

-- ✅ Index composite optimisé pour la requête:
-- SELECT ... FROM delivery_matching_queue
-- WHERE status IN ('queued', 'searching')
--   AND next_attempt_at <= NOW()
-- ORDER BY priority ASC, next_attempt_at ASC
-- LIMIT $1

-- Supprimer les anciens index non optimaux s'ils existent
DROP INDEX IF EXISTS idx_delivery_matching_queue_status_next_attempt_old;

-- ✅ NOUVEAU: Index composite couvrant tous les critères de la requête
-- L'ordre des colonnes est optimisé pour la requête:
-- 1. status (filtre WHERE)
-- 2. next_attempt_at (filtre WHERE + ORDER BY)
-- 3. priority (ORDER BY)
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_optimized
ON delivery_matching_queue (status, next_attempt_at, priority)
WHERE status IN ('queued', 'searching');

-- ✅ Index partiel supplémentaire pour les requêtes avec next_attempt_at <= NOW()
-- NOTE: NOW() n'est pas IMMUTABLE, donc on ne peut pas l'utiliser dans un index partiel
-- On crée un index simple qui sera utilisé par PostgreSQL avec le filtre WHERE dans la requête
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_priority_next_attempt
ON delivery_matching_queue (priority, next_attempt_at)
WHERE status IN ('queued', 'searching');

-- Commentaire
COMMENT ON INDEX idx_delivery_matching_queue_optimized IS 
'Index composite optimisé pour la requête de sélection des jobs de matching prêts à être traités';

COMMENT ON INDEX idx_delivery_matching_queue_priority_next_attempt IS 
'Index partiel pour les jobs en attente (status IN queued/searching) - optimise ORDER BY priority, next_attempt_at';


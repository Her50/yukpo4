-- ✅ CORRECTION 2025-12-09: Optimisation des requêtes lentes identifiées dans les logs
-- Problèmes: Requêtes >1s sur pharmacies et delivery_matching_queue
-- Compatible: SQLx offline mode (utilise sqlx::query() non typé)

-- =====================================================
-- 1. Optimisation requête pharmacies is_on_duty_now
-- =====================================================

-- Index composite pour la requête: WHERE is_active = TRUE AND is_on_duty_now = TRUE ORDER BY nom ASC
CREATE INDEX IF NOT EXISTS idx_pharmacies_active_on_duty_nom
ON pharmacies(is_active, is_on_duty_now, nom)
WHERE is_active = TRUE AND is_on_duty_now = TRUE;

-- =====================================================
-- 2. Optimisation requête delivery_matching_queue
-- =====================================================

-- Index composite pour la requête: 
-- WHERE status IN ('queued', 'searching') AND next_attempt_at <= NOW()
-- ORDER BY priority ASC, next_attempt_at ASC
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_status_priority_next_attempt
ON delivery_matching_queue(status, priority, next_attempt_at)
WHERE status IN ('queued', 'searching');

-- Index partiel pour next_attempt_at <= NOW() (pour filtrage rapide)
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_next_attempt_pending
ON delivery_matching_queue(next_attempt_at)
WHERE status IN ('queued', 'searching') AND next_attempt_at <= NOW();

-- =====================================================
-- 3. Notes
-- =====================================================

-- Ces index permettront d'optimiser les requêtes fréquentes :
-- 1. pharmacies: SELECT * FROM pharmacies WHERE is_active = TRUE AND is_on_duty_now = TRUE ORDER BY nom ASC
-- 2. delivery_matching_queue: SELECT ... WHERE status IN ('queued', 'searching') AND next_attempt_at <= NOW() ORDER BY priority ASC, next_attempt_at ASC


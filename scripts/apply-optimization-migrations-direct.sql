-- ============================================================================
-- Script SQL pour appliquer directement les migrations d'optimisation
-- Date: 2026-02-18
-- Usage: Exécuter ce script dans votre client PostgreSQL (psql, pgAdmin, etc.)
-- ============================================================================

-- ============================================================================
-- Migration 1: Optimisation delivery_matching_queue
-- ============================================================================

-- ✅ Vérifier et améliorer l'index existant
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'delivery_matching_queue' 
        AND indexname = 'idx_delivery_matching_queue_status'
    ) THEN
        ANALYZE delivery_matching_queue;
        RAISE NOTICE 'Index idx_delivery_matching_queue_status existe - Statistiques mises à jour';
    ELSE
        CREATE INDEX idx_delivery_matching_queue_status
        ON delivery_matching_queue(status, next_attempt_at);
        RAISE NOTICE 'Index idx_delivery_matching_queue_status créé';
    END IF;
END $$;

-- ✅ NOUVEAU: Index partiel optimisé
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_ready_optimized
ON delivery_matching_queue (priority ASC, next_attempt_at ASC)
WHERE status IN ('queued', 'searching');

-- ✅ NOUVEAU: Index pour mises à jour
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_status_updated
ON delivery_matching_queue(status, updated_at DESC)
WHERE status IN ('queued', 'searching', 'processing');

COMMENT ON INDEX idx_delivery_matching_queue_ready_optimized IS 
'Index partiel optimisé pour la requête de sélection des jobs prêts (status IN queued/searching) - optimise ORDER BY priority, next_attempt_at';

COMMENT ON INDEX idx_delivery_matching_queue_status_updated IS 
'Index pour les mises à jour de status - optimise les requêtes de monitoring';

ANALYZE delivery_matching_queue;

-- ============================================================================
-- Migration 2: Optimisation delivery_proximity_suggestions
-- ============================================================================

-- ✅ NOUVEAU: Index partiel optimisé
CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_auto_confirm_optimized
ON delivery_proximity_suggestions (status, created_at, auto_confirm_after_seconds)
WHERE status = 'pending' AND auto_confirm_after_seconds IS NOT NULL;

-- ✅ NOUVEAU: Index pour mises à jour
CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_status_updated
ON delivery_proximity_suggestions(status, updated_at DESC)
WHERE status IN ('pending', 'confirmed', 'auto_confirmed');

ANALYZE delivery_proximity_suggestions;

COMMENT ON INDEX idx_delivery_proximity_suggestions_auto_confirm_optimized IS 
'Index partiel optimisé pour la requête de sélection des suggestions expirées (status=pending, auto_confirm_after_seconds IS NOT NULL)';

COMMENT ON INDEX idx_delivery_proximity_suggestions_status_updated IS 
'Index pour les mises à jour de status - optimise les requêtes de monitoring';

-- ============================================================================
-- Migration 3: Optimisation product_orders
-- ============================================================================

-- ✅ Supprimer l'ancien index s'il existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'product_orders' 
        AND indexname = 'idx_product_orders_validation_deadline'
    ) THEN
        DROP INDEX idx_product_orders_validation_deadline;
        RAISE NOTICE 'Ancien index idx_product_orders_validation_deadline supprimé';
    END IF;
END $$;

-- ✅ NOUVEAU: Index partiel optimisé
CREATE INDEX IF NOT EXISTS idx_product_orders_validation_deadline_optimized
ON product_orders (status, validation_deadline)
WHERE status = 'pending' AND validation_deadline IS NOT NULL;

-- ✅ NOUVEAU: Index avec tri
CREATE INDEX IF NOT EXISTS idx_product_orders_pending_validation_created
ON product_orders(status, validation_deadline, created_at DESC)
WHERE status = 'pending' AND validation_deadline IS NOT NULL;

ANALYZE product_orders;

COMMENT ON INDEX idx_product_orders_validation_deadline_optimized IS 
'Index partiel optimisé pour la requête de sélection des commandes avec validation_deadline expirée (status=pending)';

COMMENT ON INDEX idx_product_orders_pending_validation_created IS 
'Index pour les requêtes avec tri par created_at - optimise les requêtes de monitoring';

-- ============================================================================
-- ✅ Résumé
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Toutes les migrations d''optimisation ont été appliquées';
    RAISE NOTICE '📊 Index créés:';
    RAISE NOTICE '   - delivery_matching_queue: 2 nouveaux index';
    RAISE NOTICE '   - delivery_proximity_suggestions: 2 nouveaux index';
    RAISE NOTICE '   - product_orders: 2 nouveaux index (1 remplacé)';
END $$;


-- ============================================================================
-- Migrations d'Optimisation SQL Combinées (18/02/2026)
-- Appliquez ce fichier directement sur Cloud SQL
-- ============================================================================

-- ============================================================================
-- Migration 1: Optimisation delivery_matching_queue (1.8s -> <500ms)
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

-- ✅ NOUVEAU: Index partiel optimisé pour la requête exacte
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_ready_optimized
ON delivery_matching_queue (priority ASC, next_attempt_at ASC)
WHERE status IN ('queued', 'searching');

-- ✅ NOUVEAU: Index pour accélérer les mises à jour de status
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_status_updated
ON delivery_matching_queue(status, updated_at DESC)
WHERE status IN ('queued', 'searching', 'processing');

COMMENT ON INDEX idx_delivery_matching_queue_ready_optimized IS 
'Index partiel optimisé pour la requête de sélection des jobs prêts (status IN queued/searching) - optimise ORDER BY priority, next_attempt_at';

COMMENT ON INDEX idx_delivery_matching_queue_status_updated IS 
'Index pour les mises à jour de status - optimise les requêtes de monitoring';

ANALYZE delivery_matching_queue;

-- ============================================================================
-- Migration 2: Optimisation delivery_proximity_suggestions (1.1s -> <500ms)
-- ============================================================================

-- ✅ NOUVEAU: Index partiel optimisé pour la requête exacte
CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_auto_confirm_optimized
ON delivery_proximity_suggestions (status, created_at, auto_confirm_after_seconds)
WHERE status = 'pending' AND auto_confirm_after_seconds IS NOT NULL;

-- ✅ NOUVEAU: Index pour accélérer les mises à jour de status
CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_status_updated
ON delivery_proximity_suggestions(status, updated_at DESC)
WHERE status IN ('pending', 'confirmed', 'auto_confirmed');

COMMENT ON INDEX idx_delivery_proximity_suggestions_auto_confirm_optimized IS 
'Index partiel optimisé pour la requête de sélection des suggestions expirées (status=pending, auto_confirm_after_seconds IS NOT NULL)';

COMMENT ON INDEX idx_delivery_proximity_suggestions_status_updated IS 
'Index pour les mises à jour de status - optimise les requêtes de monitoring';

ANALYZE delivery_proximity_suggestions;

-- ============================================================================
-- Migration 3: Optimisation product_orders (1.1s -> <500ms)
-- ============================================================================

-- ✅ Vérifier si l'index existant existe et l'améliorer
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

-- ✅ NOUVEAU: Index partiel optimisé pour la requête exacte
CREATE INDEX IF NOT EXISTS idx_product_orders_validation_deadline_optimized
ON product_orders (status, validation_deadline)
WHERE status = 'pending' AND validation_deadline IS NOT NULL;

-- ✅ NOUVEAU: Index pour accélérer les requêtes avec validation_deadline et created_at
CREATE INDEX IF NOT EXISTS idx_product_orders_pending_validation_created
ON product_orders(status, validation_deadline, created_at DESC)
WHERE status = 'pending' AND validation_deadline IS NOT NULL;

COMMENT ON INDEX idx_product_orders_validation_deadline_optimized IS 
'Index partiel optimisé pour la requête de sélection des commandes avec validation_deadline expirée (status=pending)';

COMMENT ON INDEX idx_product_orders_pending_validation_created IS 
'Index pour les requêtes avec tri par created_at - optimise les requêtes de monitoring';

ANALYZE product_orders;

-- ============================================================================
-- Résumé des optimisations appliquées
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migrations d''optimisation appliquées avec succès!';
    RAISE NOTICE '   - delivery_matching_queue: Index optimisés créés';
    RAISE NOTICE '   - delivery_proximity_suggestions: Index optimisés créés';
    RAISE NOTICE '   - product_orders: Index optimisés créés';
    RAISE NOTICE '   - ANALYZE exécuté sur toutes les tables';
END $$;


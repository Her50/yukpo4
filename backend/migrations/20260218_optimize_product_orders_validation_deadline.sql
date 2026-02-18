-- ============================================================================
-- Migration: Optimisation requête product_orders avec validation_deadline
-- Date: 2026-02-18
-- Problème: Requête prend 1.1s (seuil d'alerte: 1s)
-- Solution: Améliorer l'index existant pour la requête exacte
-- ============================================================================

-- ✅ Requête lente identifiée:
-- SELECT id, service_id, product_index, client_user_id, provider_user_id
-- FROM product_orders
-- WHERE status = 'pending'
--   AND validation_deadline IS NOT NULL
--   AND validation_deadline <= $1
-- LIMIT 50

-- ✅ Vérifier si l'index existant existe et l'améliorer
DO $$
BEGIN
    -- Supprimer l'ancien index s'il existe (moins optimal)
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
-- L'index couvre:
-- 1. status = 'pending' (filtre WHERE)
-- 2. validation_deadline (filtre WHERE avec <=)
-- L'ordre des colonnes est optimisé pour la requête
CREATE INDEX IF NOT EXISTS idx_product_orders_validation_deadline_optimized
ON product_orders (status, validation_deadline)
WHERE status = 'pending' AND validation_deadline IS NOT NULL;

-- ✅ NOUVEAU: Index pour accélérer les requêtes avec validation_deadline et created_at
CREATE INDEX IF NOT EXISTS idx_product_orders_pending_validation_created
ON product_orders(status, validation_deadline, created_at DESC)
WHERE status = 'pending' AND validation_deadline IS NOT NULL;

-- ✅ Analyser la table pour mettre à jour les statistiques du planificateur
ANALYZE product_orders;

-- Commentaire
COMMENT ON INDEX idx_product_orders_validation_deadline_optimized IS 
'Index partiel optimisé pour la requête de sélection des commandes avec validation_deadline expirée (status=pending)';

COMMENT ON INDEX idx_product_orders_pending_validation_created IS 
'Index pour les requêtes avec tri par created_at - optimise les requêtes de monitoring';


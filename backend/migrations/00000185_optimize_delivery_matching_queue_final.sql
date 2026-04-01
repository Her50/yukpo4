-- ============================================================================
-- Migration: Optimisation finale requête delivery_matching_queue
-- Date: 2026-02-18
-- Problème: Requête prend 1.8s (seuil d'alerte: 1s)
-- Solution: Améliorer l'index existant et ajouter un index partiel optimisé
-- ============================================================================

-- ✅ Vérifier et améliorer l'index existant
-- L'index idx_delivery_matching_queue_status existe déjà mais peut être optimisé
DO $$
BEGIN
    -- Vérifier si l'index existe
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'delivery_matching_queue' 
        AND indexname = 'idx_delivery_matching_queue_status'
    ) THEN
        -- Analyser la table pour mettre à jour les statistiques
        ANALYZE delivery_matching_queue;
        RAISE NOTICE 'Index idx_delivery_matching_queue_status existe - Statistiques mises à jour';
    ELSE
        -- Créer l'index s'il n'existe pas
        CREATE INDEX idx_delivery_matching_queue_status
        ON delivery_matching_queue(status, next_attempt_at);
        RAISE NOTICE 'Index idx_delivery_matching_queue_status créé';
    END IF;
END $$;

-- ✅ NOUVEAU: Index partiel optimisé pour la requête exacte
-- La requête filtre sur: status IN ('queued', 'searching') AND next_attempt_at <= NOW()
-- Puis ordonne par: priority ASC, next_attempt_at ASC
-- L'index partiel permet de ne scanner que les lignes pertinentes
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_ready_optimized
ON delivery_matching_queue (priority ASC, next_attempt_at ASC)
WHERE status IN ('queued', 'searching');

-- ✅ NOUVEAU: Index pour accélérer les mises à jour de status
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_status_updated
ON delivery_matching_queue(status, updated_at DESC)
WHERE status IN ('queued', 'searching');

-- Commentaire
COMMENT ON INDEX idx_delivery_matching_queue_ready_optimized IS 
'Index partiel optimisé pour la requête de sélection des jobs prêts (status IN queued/searching) - optimise ORDER BY priority, next_attempt_at';

COMMENT ON INDEX idx_delivery_matching_queue_status_updated IS 
'Index pour les mises à jour de status - optimise les requêtes de monitoring';

-- ✅ Analyser la table pour mettre à jour les statistiques du planificateur
ANALYZE delivery_matching_queue;


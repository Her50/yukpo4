-- Migration pour optimiser les requêtes de monitoring identifiées comme lentes dans les logs
-- Date: 2025-11-28
-- Description: Optimise les requêtes de monitoring qui s'exécutent toutes les 15-30 secondes

-- ✅ OPTIMISATION 1: Index pour video_generation_jobs (requêtes toutes les 15s) (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'video_generation_jobs') THEN
        -- Améliore: SELECT status, COUNT(*) FROM video_generation_jobs GROUP BY status
        CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status 
        ON video_generation_jobs (status)
        WHERE status IS NOT NULL;

        -- Améliore: SELECT COUNT(*) FROM video_generation_jobs WHERE status = 'failed' AND updated_at >= ...
        CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status_updated_at 
        ON video_generation_jobs (status, updated_at DESC)
        WHERE status IN ('failed', 'completed', 'queued', 'running');

        -- Améliore: SELECT MAX(updated_at) FROM video_generation_jobs WHERE status = 'completed'
        CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_completed_updated_at 
        ON video_generation_jobs (updated_at DESC)
        WHERE status = 'completed';

        -- Améliore: SELECT job_id, status, updated_at WHERE status IN ('queued', 'running') AND updated_at < ...
        CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_stale 
        ON video_generation_jobs (status, updated_at ASC)
        WHERE status IN ('queued', 'running');

        COMMENT ON INDEX idx_video_generation_jobs_status IS 
        'Index pour optimiser le GROUP BY status dans video_generation_jobs (monitoring toutes les 15s)';

        COMMENT ON INDEX idx_video_generation_jobs_status_updated_at IS 
        'Index composite pour optimiser les requêtes de comptage par statut et période (monitoring toutes les 15s)';

        COMMENT ON INDEX idx_video_generation_jobs_completed_updated_at IS 
        'Index pour optimiser la recherche du dernier job complété (monitoring toutes les 15s)';

        COMMENT ON INDEX idx_video_generation_jobs_stale IS 
        'Index pour optimiser la détection des jobs bloqués (monitoring toutes les 15s)';
    END IF;
END $$;

-- ✅ OPTIMISATION 2: Index pour media (requête lente ~2.4ms) (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'media') THEN
        -- Améliore: SELECT COUNT(*) FROM media WHERE media_type = 'video' AND uploaded_at >= ...
        CREATE INDEX IF NOT EXISTS idx_media_type_uploaded_at 
        ON media (media_type, uploaded_at DESC)
        WHERE media_type = 'video';

        COMMENT ON INDEX idx_media_type_uploaded_at IS 
        'Index pour optimiser le comptage des vidéos par période (monitoring toutes les 15s)';
    END IF;
END $$;

-- ✅ OPTIMISATION 3: Index pour media_engagement (requête lente ~2.7ms) (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'media_engagement') THEN
        -- Améliore: SELECT COUNT(*) FILTER (WHERE event_type = 'view') ... WHERE occurred_at >= ...
        CREATE INDEX IF NOT EXISTS idx_media_engagement_event_occurred 
        ON media_engagement (event_type, occurred_at DESC)
        WHERE event_type IN ('view', 'share', 'quality_score');

        COMMENT ON INDEX idx_media_engagement_event_occurred IS 
        'Index pour optimiser les statistiques d engagement par type et période (monitoring toutes les 15s)';
    END IF;
END $$;

-- ✅ OPTIMISATION 4: Index pour media_distribution (monitoring toutes les 15s) (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'media_distribution') THEN
        -- Améliore: SELECT COUNT(*) FILTER (WHERE status = 'completed') ... WHERE updated_at >= ...
        CREATE INDEX IF NOT EXISTS idx_media_distribution_status_updated_at 
        ON media_distribution (status, updated_at DESC)
        WHERE status IN ('completed', 'scheduled', 'processing');

        COMMENT ON INDEX idx_media_distribution_status_updated_at IS 
        'Index pour optimiser les statistiques de distribution par statut et période (monitoring toutes les 15s)';
    END IF;
END $$;

-- ✅ OPTIMISATION 5: Index pour live_flash_sales (requête lente ~3.4ms) (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'live_flash_sales') THEN
        -- Améliore: SELECT lfs.* FROM live_flash_sales lfs JOIN live_sessions ls ...
        CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status_start_at 
        ON live_flash_sales (status, start_at)
        WHERE status = 'scheduled';

        CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status_end_at 
        ON live_flash_sales (status, end_at)
        WHERE status IN ('scheduled', 'live');

        CREATE INDEX IF NOT EXISTS idx_live_flash_sales_live_session_id 
        ON live_flash_sales (live_session_id)
        WHERE live_session_id IS NOT NULL;

        -- Améliore: UPDATE live_flash_sales SET status = 'ended' WHERE status IN ('scheduled', 'live') AND end_at <= ...
        CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status_end_at_for_update 
        ON live_flash_sales (status, end_at, updated_at)
        WHERE status IN ('scheduled', 'live');

        COMMENT ON INDEX idx_live_flash_sales_status_start_at IS 
        'Index pour optimiser la recherche des flash sales programmés (monitoring toutes les 30s)';

        COMMENT ON INDEX idx_live_flash_sales_status_end_at IS 
        'Index pour optimiser la recherche des flash sales à terminer (monitoring toutes les 30s)';

        COMMENT ON INDEX idx_live_flash_sales_live_session_id IS 
        'Index pour optimiser les JOINs avec live_sessions (monitoring toutes les 30s)';

        COMMENT ON INDEX idx_live_flash_sales_status_end_at_for_update IS 
        'Index pour optimiser les UPDATE de statut des flash sales (monitoring toutes les 30s)';
    END IF;
END $$;

-- ✅ OPTIMISATION 6: Index pour global_promo_events (monitoring toutes les 30s) (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'global_promo_events') THEN
        CREATE INDEX IF NOT EXISTS idx_global_promo_events_status_starts_at 
        ON global_promo_events (status, starts_at)
        WHERE status = 'scheduled';

        CREATE INDEX IF NOT EXISTS idx_global_promo_events_status_ends_at 
        ON global_promo_events (status, ends_at)
        WHERE status IN ('scheduled', 'live');

        COMMENT ON INDEX idx_global_promo_events_status_starts_at IS 
        'Index pour optimiser la recherche des événements promo programmés (monitoring toutes les 30s)';

        COMMENT ON INDEX idx_global_promo_events_status_ends_at IS 
        'Index pour optimiser la recherche des événements promo à terminer (monitoring toutes les 30s)';
    END IF;
END $$;

-- ✅ OPTIMISATION 7: Index pour delivery_matching_queue (monitoring toutes les 30s) (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_matching_queue') THEN
        CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_status_next_attempt 
        ON delivery_matching_queue (status, next_attempt_at ASC, priority ASC)
        WHERE status IN ('queued', 'searching');

        COMMENT ON INDEX idx_delivery_matching_queue_status_next_attempt IS 
        'Index pour optimiser le traitement de la file de matching (monitoring toutes les 30s)';
    END IF;
END $$;

-- ✅ OPTIMISATION 8: Index pour product_orders (monitoring toutes les 30s) (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_orders') THEN
        CREATE INDEX IF NOT EXISTS idx_product_orders_status_validation_deadline 
        ON product_orders (status, validation_deadline)
        WHERE status = 'pending' AND validation_deadline IS NOT NULL;

        COMMENT ON INDEX idx_product_orders_status_validation_deadline IS 
        'Index pour optimiser la recherche des commandes expirées (monitoring toutes les 30s)';
    END IF;
END $$;

-- ✅ OPTIMISATION 9: Index pour delivery_proximity_suggestions (monitoring toutes les 30s) (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_proximity_suggestions') THEN
        CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_status_created 
        ON delivery_proximity_suggestions (status, created_at)
        WHERE status = 'pending' AND auto_confirm_after_seconds IS NOT NULL;

        COMMENT ON INDEX idx_delivery_proximity_suggestions_status_created IS 
        'Index pour optimiser la recherche des suggestions de proximité à confirmer (monitoring toutes les 30s)';
    END IF;
END $$;

-- ✅ OPTIMISATION 10: Index pour deliveries status timeouts (monitoring toutes les 30s) (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deliveries') THEN
        CREATE INDEX IF NOT EXISTS idx_deliveries_status_updated_at 
        ON deliveries (status, updated_at)
        WHERE status NOT IN ('delivered', 'cancelled', 'completed');

        COMMENT ON INDEX idx_deliveries_status_updated_at IS 
        'Index pour optimiser la recherche des livraisons en timeout (monitoring toutes les 30s)';
    END IF;
END $$;

-- ✅ OPTIMISATION 11: Index pour social_publication_jobs (monitoring toutes les 30s) (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'social_publication_jobs') THEN
        CREATE INDEX IF NOT EXISTS idx_social_publication_jobs_status_scheduled 
        ON social_publication_jobs (status, scheduled_for ASC)
        WHERE status = 'queued';

        COMMENT ON INDEX idx_social_publication_jobs_status_scheduled IS 
        'Index pour optimiser la recherche des jobs de publication à traiter (monitoring toutes les 30s)';
    END IF;
END $$;

-- ✅ Mise à jour des statistiques pour le planificateur PostgreSQL (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'video_generation_jobs') THEN
        ANALYZE video_generation_jobs;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'media') THEN
        ANALYZE media;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'media_engagement') THEN
        ANALYZE media_engagement;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'media_distribution') THEN
        ANALYZE media_distribution;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'live_flash_sales') THEN
        ANALYZE live_flash_sales;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'global_promo_events') THEN
        ANALYZE global_promo_events;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_matching_queue') THEN
        ANALYZE delivery_matching_queue;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_orders') THEN
        ANALYZE product_orders;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_proximity_suggestions') THEN
        ANALYZE delivery_proximity_suggestions;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deliveries') THEN
        ANALYZE deliveries;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'social_publication_jobs') THEN
        ANALYZE social_publication_jobs;
    END IF;
END $$;

-- ✅ Note: Ces index sont optimisés pour les requêtes de monitoring fréquentes
-- Les index partiels (WHERE) réduisent la taille et améliorent les performances
-- Les index composites permettent des recherches rapides sur plusieurs colonnes


-- Migration pour optimiser les index du service delivery
-- Date: 2025-12-21
-- Problèmes identifiés: Requêtes lentes dans delivery_repository.rs
-- Solution: Créer les index manquants pour accélérer les requêtes fréquentes

-- ✅ INDEX 1: Pour list_delivery_ids_for_user (creator_id)
CREATE INDEX IF NOT EXISTS idx_deliveries_creator_status_requested 
ON deliveries(creator_id, status, requested_at DESC)
WHERE status <> 'completed'::delivery_status;

-- ✅ INDEX 2: Pour list_delivery_ids_for_user (recipient_user_id)
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_status_requested 
ON deliveries(recipient_user_id, status, requested_at DESC)
WHERE status <> 'completed'::delivery_status AND recipient_user_id IS NOT NULL;

-- ✅ INDEX 3: Pour le JOIN avec couriers dans list_delivery_ids_for_user
CREATE INDEX IF NOT EXISTS idx_deliveries_courier_id 
ON deliveries(courier_id)
WHERE courier_id IS NOT NULL;

-- ✅ INDEX 4: Pour les recherches géospatiales (pickup)
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_location 
ON deliveries USING GIST(pickup_location)
WHERE pickup_location IS NOT NULL;

-- ✅ INDEX 5: Pour les recherches géospatiales (dropoff)
CREATE INDEX IF NOT EXISTS idx_deliveries_dropoff_location 
ON deliveries USING GIST(dropoff_location)
WHERE dropoff_location IS NOT NULL;

-- ✅ INDEX 6: Pour couriers.user_id (JOIN dans list_delivery_ids_for_user)
CREATE INDEX IF NOT EXISTS idx_couriers_user_id 
ON couriers(user_id)
WHERE user_id IS NOT NULL;

-- ✅ INDEX 7: Pour list_matching_candidates (courier_availability_snapshots)
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_active 
ON courier_availability_snapshots(captured_at DESC, is_online, active_deliveries, max_capacity)
WHERE is_online = TRUE AND captured_at >= NOW() - INTERVAL '30 minutes';

-- ✅ INDEX 8: Pour list_matching_candidates (géospatial)
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_location 
ON courier_availability_snapshots USING GIST(location)
WHERE location IS NOT NULL;

-- ✅ INDEX 9: Pour list_matching_candidates (courier_id)
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_courier 
ON courier_availability_snapshots(courier_id, captured_at DESC);

-- ✅ INDEX 10: Pour LEFT JOIN LATERAL dans list_matching_candidates
CREATE INDEX IF NOT EXISTS idx_courier_zone_assignments_active 
ON courier_zone_assignments(courier_id, is_active, is_primary DESC, updated_at DESC)
WHERE is_active = TRUE;

-- ✅ INDEX 11: Pour fetch_matching_queue_batch
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_retry 
ON delivery_matching_queue(retry_at, status)
WHERE status IN ('queued', 'searching');

-- ✅ INDEX 12: Pour fetch_matching_queue_batch (delivery_id)
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_delivery 
ON delivery_matching_queue(delivery_id);

-- ✅ Analyser les tables pour mettre à jour les statistiques
ANALYZE deliveries;
ANALYZE couriers;
ANALYZE courier_availability_snapshots;
ANALYZE courier_zone_assignments;
ANALYZE delivery_matching_queue;


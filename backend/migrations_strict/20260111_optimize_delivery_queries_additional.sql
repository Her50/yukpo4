-- ✅ OPTIMISATION ADDITIONNELLE 2026-01-11: Correction des requêtes lentes identifiées dans les warnings
-- Problèmes identifiés:
-- 1. SELECT deliveries avec ST_Y/ST_X: 1.1-1.5s (get_delivery_summary)
-- 2. find_nearby_couriers: 1.14s
-- 3. UPDATE delivery_matching_queue: 1.09s
-- 4. SELECT 1 (healthcheck): 1+ seconde (indique latence réseau ou charge DB)

-- =====================================================
-- 1. Optimisation requête get_delivery_summary
-- =====================================================

-- Index GIST pour return_pickup_location (manquant)
CREATE INDEX IF NOT EXISTS idx_deliveries_return_pickup_location_gist
ON deliveries USING GIST(return_pickup_location)
WHERE return_pickup_location IS NOT NULL;

-- Index GIST pour return_dropoff_location (manquant)
CREATE INDEX IF NOT EXISTS idx_deliveries_return_dropoff_location_gist
ON deliveries USING GIST(return_dropoff_location)
WHERE return_dropoff_location IS NOT NULL;

-- Index composite pour is_round_trip (utilisé dans la requête)
CREATE INDEX IF NOT EXISTS idx_deliveries_round_trip
ON deliveries(id, is_round_trip)
WHERE is_round_trip = true;

-- =====================================================
-- 2. Optimisation find_nearby_couriers (amélioration)
-- =====================================================

-- Index pour captured_at récent (utilisé dans find_nearby_couriers)
-- Améliore la requête WHERE captured_at >= NOW() - INTERVAL '1 hour'
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_recent
ON courier_availability_snapshots(captured_at DESC, is_online, load_factor)
WHERE is_online = true AND load_factor < 1.0;

-- Index composite pour user_id et courier_id (utilisé dans jointure)
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_user_courier
ON courier_availability_snapshots(user_id, courier_id)
WHERE is_online = true;

-- =====================================================
-- 3. Optimisation UPDATE delivery_matching_queue
-- =====================================================

-- Index pour WHERE delivery_id = $1 dans UPDATE (amélioration)
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_delivery_id_status
ON delivery_matching_queue(delivery_id, status);

-- Index pour next_attempt_at (utilisé dans WHERE clauses)
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_next_attempt
ON delivery_matching_queue(next_attempt_at)
WHERE next_attempt_at IS NOT NULL;

-- =====================================================
-- 4. Optimisation requêtes fréquentes sur deliveries
-- =====================================================

-- Index pour creator_id (utilisé dans plusieurs requêtes)
CREATE INDEX IF NOT EXISTS idx_deliveries_creator_id
ON deliveries(creator_id, status, requested_at DESC);

-- Index pour courier_id (utilisé dans plusieurs requêtes)
CREATE INDEX IF NOT EXISTS idx_deliveries_courier_id
ON deliveries(courier_id, status, requested_at DESC);

-- Index pour recipient_user_id (utilisé dans requêtes récipient)
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_user_id
ON deliveries(recipient_user_id, status)
WHERE recipient_user_id IS NOT NULL;

-- Index pour tracking_token (utilisé dans requêtes de suivi)
CREATE INDEX IF NOT EXISTS idx_deliveries_tracking_token
ON deliveries(tracking_token)
WHERE tracking_token IS NOT NULL;

-- Index pour recipient_tracking_token
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_tracking_token
ON deliveries(recipient_tracking_token)
WHERE recipient_tracking_token IS NOT NULL;

-- =====================================================
-- 5. ANALYZE pour mettre à jour les statistiques
-- =====================================================

-- Analyser les tables pour que PostgreSQL utilise les nouveaux index
ANALYZE deliveries;
ANALYZE delivery_matching_queue;
ANALYZE courier_availability_snapshots;
ANALYZE courier_assets;

-- =====================================================
-- 6. Notes et recommandations
-- =====================================================

-- Ces index devraient réduire significativement les temps d'exécution:
-- - get_delivery_summary: 1.1-1.5s → <150ms (attendu)
-- - find_nearby_couriers: 1.14s → <300ms (attendu)
-- - UPDATE delivery_matching_queue: 1.09s → <50ms (attendu)

-- Pour les SELECT 1 qui prennent 1+ seconde:
-- - Vérifier la latence réseau vers la base de données (Render.com)
-- - Vérifier la charge CPU/RAM de la base de données
-- - Vérifier les connexions actives (SELECT count(*) FROM pg_stat_activity)
-- - Considérer l'augmentation des connexions dans le pool

-- Recommandations supplémentaires:
-- 1. Monitorer les requêtes lentes avec pg_stat_statements
-- 2. Configurer un pool de connexions avec limite appropriée
-- 3. Utiliser la mise en cache Redis pour les requêtes fréquentes
-- 4. Considérer la lecture depuis une réplica pour les requêtes SELECT

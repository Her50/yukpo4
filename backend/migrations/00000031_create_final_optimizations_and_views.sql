-- Optimisations finales, index et vues

-- =====================================================
-- ✅ OPTIMISATION ADDITIONNELLE 2026-01-11: Correction des requêtes lentes identifiées dans les warnings
-- =====================================================

-- 1. Optimisation requête get_delivery_summary
-- Index GIST pour return_pickup_location (manquant)
-- Note: Ces index seront créés après que la table deliveries existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'deliveries'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_deliveries_return_pickup_location_gist
        ON deliveries USING GIST(return_pickup_location)
        WHERE return_pickup_location IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_deliveries_return_dropoff_location_gist
        ON deliveries USING GIST(return_dropoff_location)
        WHERE return_dropoff_location IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_deliveries_round_trip
        ON deliveries(id, is_round_trip)
        WHERE is_round_trip = true;
    END IF;
END $$;

-- 2. Optimisation find_nearby_couriers (amélioration)
-- Index pour captured_at récent (utilisé dans find_nearby_couriers)
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_recent
ON courier_availability_snapshots(captured_at DESC, is_online, load_factor)
WHERE is_online = true AND load_factor < 1.0;

-- Index composite pour user_id et courier_id (utilisé dans jointure)
-- ✅ CORRECTION 2026-01-30: Créer l'index seulement si user_id existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'courier_availability_snapshots' 
        AND column_name = 'user_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_user_courier
        ON courier_availability_snapshots(user_id, courier_id)
        WHERE is_online = true;
    END IF;
END $$;

-- 3. Optimisation UPDATE delivery_matching_queue
-- Index pour WHERE delivery_id = $1 dans UPDATE (amélioration)
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_delivery_id_status
ON delivery_matching_queue(delivery_id, status);

-- Index pour next_attempt_at (utilisé dans WHERE clauses)
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_next_attempt
ON delivery_matching_queue(next_attempt_at)
WHERE next_attempt_at IS NOT NULL;

-- 4. Optimisation requêtes fréquentes sur deliveries
-- Note: Ces index seront créés après que la table deliveries existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'deliveries'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_deliveries_creator_id
        ON deliveries(creator_id, status, requested_at DESC);

        CREATE INDEX IF NOT EXISTS idx_deliveries_courier_id
        ON deliveries(courier_id, status, requested_at DESC);

        CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_user_id
        ON deliveries(recipient_user_id, status)
        WHERE recipient_user_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_deliveries_tracking_token
        ON deliveries(tracking_token)
        WHERE tracking_token IS NOT NULL;
    END IF;
END $$;

-- Index pour recipient_tracking_token
-- ✅ NOTE: Cet index est déjà créé dans 00000008_create_delivery_tables.sql
-- Conservé ici pour référence mais ne sera pas dupliqué grâce à IF NOT EXISTS
-- CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_tracking_token
-- ON deliveries(recipient_tracking_token)
-- WHERE recipient_tracking_token IS NOT NULL;

-- 5. ANALYZE pour mettre à jour les statistiques
-- ANALYZE deliveries; -- Commenté car la table n'existe peut-être pas encore
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'deliveries'
    ) THEN
        ANALYZE deliveries;
    END IF;
END $$;
ANALYZE delivery_matching_queue;
ANALYZE courier_availability_snapshots;
ANALYZE courier_assets;


-- ============================================================================
-- Migration: Optimisation requêtes delivery lentes
-- Date: 2026-01-12
-- Problèmes identifiés:
-- 1. UPDATE delivery_matching_queue WHERE delivery_id (1.44s)
-- 2. SELECT courier_availability_snapshots avec JOIN LATERAL (1.0-1.1s)
-- 3. SELECT deliveries WHERE id avec calculs ST_Y/ST_X (1.47s)
-- ============================================================================

-- ============================================================================
-- 1. OPTIMISATION UPDATE delivery_matching_queue
-- ============================================================================

-- ✅ Index unique sur delivery_id pour UPDATE rapide
-- Vérifier si l'index existe déjà, sinon le créer
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'delivery_matching_queue' 
        AND indexname = 'idx_delivery_matching_queue_delivery_id_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_delivery_matching_queue_delivery_id_unique
        ON delivery_matching_queue(delivery_id);
        
        RAISE NOTICE 'Index unique créé sur delivery_matching_queue.delivery_id';
    ELSE
        RAISE NOTICE 'Index unique existe déjà sur delivery_matching_queue.delivery_id';
    END IF;
END $$;

-- ============================================================================
-- 2. OPTIMISATION SELECT courier_availability_snapshots
-- ============================================================================

-- ✅ Index composite optimisé pour la requête exacte avec JOIN LATERAL
-- La requête filtre sur: captured_at >= NOW() - INTERVAL '30 minutes' AND is_online = TRUE
-- Puis fait un JOIN LATERAL sur courier_zone_assignments
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_online_recent
ON courier_availability_snapshots(captured_at DESC, is_online, courier_id)
WHERE is_online = TRUE;

-- ✅ Index GIST sur location pour calculs ST_Distance rapides
-- Vérifier si PostGIS est disponible
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        -- Index spatial GIST pour location (geography)
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'courier_availability_snapshots' 
            AND indexname = 'idx_courier_availability_snapshots_location_gist'
        ) THEN
            CREATE INDEX idx_courier_availability_snapshots_location_gist
            ON courier_availability_snapshots USING GIST(location)
            WHERE location IS NOT NULL AND is_online = TRUE;
            
            RAISE NOTICE 'Index GIST créé sur courier_availability_snapshots.location';
        ELSE
            RAISE NOTICE 'Index GIST existe déjà sur courier_availability_snapshots.location';
        END IF;
    ELSE
        RAISE NOTICE 'PostGIS non disponible - Index spatial ignoré';
    END IF;
END $$;

-- ✅ Index optimisé pour le JOIN LATERAL sur courier_zone_assignments
-- La requête filtre sur: courier_id = X AND is_active = TRUE
-- Puis trie par: is_primary DESC, updated_at DESC LIMIT 1
CREATE INDEX IF NOT EXISTS idx_courier_zone_assignments_lateral_join
ON courier_zone_assignments(courier_id, is_active, is_primary DESC, updated_at DESC)
WHERE is_active = TRUE;

-- ============================================================================
-- 3. OPTIMISATION SELECT deliveries (get_delivery_summary)
-- ============================================================================

-- ✅ La table deliveries.id est déjà PRIMARY KEY, donc indexé
-- Le problème vient probablement des calculs ST_Y/ST_X répétés
-- Créer des index fonctionnels pour accélérer ces calculs si souvent utilisés

-- Index fonctionnel pour pickup_lat (si souvent utilisé dans WHERE)
-- Note: PostgreSQL peut utiliser cet index pour éviter de recalculer ST_Y
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        -- Index fonctionnel pour pickup_lat
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'deliveries' 
            AND indexname = 'idx_deliveries_pickup_lat_func'
        ) THEN
            CREATE INDEX idx_deliveries_pickup_lat_func
            ON deliveries((ST_Y(pickup_location::geometry)))
            WHERE pickup_location IS NOT NULL;
            
            RAISE NOTICE 'Index fonctionnel créé pour ST_Y(pickup_location)';
        END IF;
        
        -- Index fonctionnel pour pickup_lng
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'deliveries' 
            AND indexname = 'idx_deliveries_pickup_lng_func'
        ) THEN
            CREATE INDEX idx_deliveries_pickup_lng_func
            ON deliveries((ST_X(pickup_location::geometry)))
            WHERE pickup_location IS NOT NULL;
            
            RAISE NOTICE 'Index fonctionnel créé pour ST_X(pickup_location)';
        END IF;
    END IF;
END $$;

-- ✅ Index GIST sur pickup_location et dropoff_location pour requêtes spatiales
-- (déjà créés dans 20251221_optimize_delivery_indexes.sql, mais on vérifie)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        -- Index GIST pickup_location
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'deliveries' 
            AND indexname = 'idx_deliveries_pickup_location'
        ) THEN
            CREATE INDEX idx_deliveries_pickup_location
            ON deliveries USING GIST(pickup_location)
            WHERE pickup_location IS NOT NULL;
            
            RAISE NOTICE 'Index GIST créé sur deliveries.pickup_location';
        END IF;
        
        -- Index GIST dropoff_location
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'deliveries' 
            AND indexname = 'idx_deliveries_dropoff_location'
        ) THEN
            CREATE INDEX idx_deliveries_dropoff_location
            ON deliveries USING GIST(dropoff_location)
            WHERE dropoff_location IS NOT NULL;
            
            RAISE NOTICE 'Index GIST créé sur deliveries.dropoff_location';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 4. ANALYSE DES TABLES POUR MISE À JOUR STATISTIQUES
-- ============================================================================

-- Analyser les tables pour que PostgreSQL utilise les nouveaux index
ANALYZE delivery_matching_queue;
ANALYZE courier_availability_snapshots;
ANALYZE courier_zone_assignments;
ANALYZE deliveries;

-- ============================================================================
-- 5. VACUUM ANALYZE POUR OPTIMISATION (optionnel, peut être long)
-- ============================================================================

-- VACUUM ANALYZE peut améliorer les performances mais peut prendre du temps
-- Décommenter si nécessaire après avoir testé les index
-- VACUUM ANALYZE delivery_matching_queue;
-- VACUUM ANALYZE courier_availability_snapshots;
-- VACUUM ANALYZE courier_zone_assignments;
-- VACUUM ANALYZE deliveries;

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

COMMENT ON INDEX IF EXISTS idx_delivery_matching_queue_delivery_id_unique IS 
'Index unique pour optimiser UPDATE delivery_matching_queue WHERE delivery_id';

COMMENT ON INDEX IF EXISTS idx_courier_availability_snapshots_online_recent IS 
'Index composite pour requêtes courier_availability_snapshots avec filtre captured_at >= NOW() - 30min AND is_online = TRUE';

COMMENT ON INDEX IF EXISTS idx_courier_zone_assignments_lateral_join IS 
'Index optimisé pour JOIN LATERAL sur courier_zone_assignments (courier_id, is_active, is_primary DESC, updated_at DESC)';

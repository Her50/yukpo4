-- ✅ OPTIMISATION CRITIQUE 2025-12-24: Correction des requêtes lentes identifiées dans les logs
-- Problèmes identifiés:
-- 1. Requête pharmacies avec JOIN services: 1.68s
-- 2. Requête delivery_matching_queue: 1.37s
-- 3. Requête deliveries avec tous les champs: 1.4-2.3s
-- 4. Fonction find_nearby_couriers: 2.1s
-- 5. Refresh vues matérialisées: 8-15s (normal mais peut être optimisé)

-- =====================================================
-- 1. Optimisation requête pharmacies avec JOIN services
-- =====================================================

-- Index pour la requête: SELECT p.id, p.nom, s.user_id FROM pharmacies p INNER JOIN services s ON s.id = p.service_id WHERE p.is_on_duty_now = true AND s.is_active = true
CREATE INDEX IF NOT EXISTS idx_pharmacies_service_id_active
ON pharmacies(service_id)
WHERE is_on_duty_now = true;

-- Index pour services.is_active (déjà peut-être existant, mais on s'assure)
CREATE INDEX IF NOT EXISTS idx_services_id_active
ON services(id, is_active)
WHERE is_active = true;

-- Index composite pour la jointure optimisée
CREATE INDEX IF NOT EXISTS idx_pharmacies_on_duty_service_active
ON pharmacies(service_id, is_on_duty_now)
WHERE is_on_duty_now = true;

-- =====================================================
-- 2. Optimisation requête deliveries (SELECT avec tous les champs)
-- =====================================================

-- Index sur deliveries.id (déjà probablement existant en PRIMARY KEY, mais on s'assure)
-- La requête WHERE id = $1 devrait être rapide avec PK, mais les ST_Y/ST_X peuvent être lents
-- On crée un index fonctionnel pour accélérer les extractions de coordonnées

-- Index pour pickup_location (si souvent utilisé)
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_location_gist
ON deliveries USING GIST(pickup_location)
WHERE pickup_location IS NOT NULL;

-- Index pour dropoff_location
CREATE INDEX IF NOT EXISTS idx_deliveries_dropoff_location_gist
ON deliveries USING GIST(dropoff_location)
WHERE dropoff_location IS NOT NULL;

-- Index pour store_location
CREATE INDEX IF NOT EXISTS idx_deliveries_store_location_gist
ON deliveries USING GIST(store_location)
WHERE store_location IS NOT NULL;

-- Index pour recipient_dropoff_override
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_dropoff_gist
ON deliveries USING GIST(recipient_dropoff_override)
WHERE recipient_dropoff_override IS NOT NULL;

-- Index composite pour les requêtes fréquentes sur deliveries
CREATE INDEX IF NOT EXISTS idx_deliveries_id_status
ON deliveries(id, status)
WHERE status IN ('requested', 'accepted', 'en_route_pickup', 'picked_up', 'en_route_delivery', 'completed');

-- =====================================================
-- 3. Optimisation fonction find_nearby_couriers
-- =====================================================

-- Cette fonction utilise courier_availability_snapshots avec PostGIS
-- On s'assure que les index géographiques existent

-- Index GIST pour la recherche géographique sur courier_availability_snapshots
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_location_gist
ON courier_availability_snapshots USING GIST(ST_MakePoint(longitude, latitude))
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND is_online = true;

-- Index pour is_online et load_factor (utilisés dans find_nearby_couriers)
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_online_load
ON courier_availability_snapshots(is_online, load_factor, captured_at)
WHERE is_online = true AND load_factor < 1.0;

-- Index pour courier_assets.is_primary (utilisé dans la jointure)
CREATE INDEX IF NOT EXISTS idx_courier_assets_primary
ON courier_assets(courier_id, is_primary)
WHERE is_primary = true;

-- =====================================================
-- 4. Optimisation delivery_matching_queue (amélioration des index existants)
-- =====================================================

-- Index partiel optimisé pour next_attempt_at <= NOW()
-- Améliore la requête: WHERE status IN ('queued', 'searching') AND next_attempt_at <= NOW()
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_pending_optimized
ON delivery_matching_queue(status, next_attempt_at, priority)
WHERE status IN ('queued', 'searching')
AND next_attempt_at IS NOT NULL;

-- Index pour les updates fréquents (améliore UPDATE ... WHERE delivery_id = $1)
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_delivery_id
ON delivery_matching_queue(delivery_id)
WHERE status IN ('queued', 'searching');

-- =====================================================
-- 5. Optimisation vues matérialisées (réduction temps de refresh)
-- =====================================================

-- Index pour services_search_cache (si pas déjà existant)
-- Note: La vue utilise 'id' comme colonne, pas 'service_id'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_cache') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'services_search_cache' 
            AND indexname = 'idx_services_search_cache_id'
        ) THEN
            CREATE INDEX idx_services_search_cache_id
            ON services_search_cache(id);
        END IF;
    END IF;
END $$;

-- Index pour active_products_cache
-- Note: Vérifier d'abord si la vue existe et quelle colonne elle utilise
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'active_products_cache') THEN
        -- Vérifier si la colonne id existe (utilisée par certaines vues)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'active_products_cache' 
            AND column_name = 'id'
        ) THEN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE tablename = 'active_products_cache' 
                AND indexname = 'idx_active_products_cache_id'
            ) THEN
                CREATE INDEX idx_active_products_cache_id
                ON active_products_cache(id);
            END IF;
        END IF;
    END IF;
END $$;

-- =====================================================
-- 6. Optimisation requêtes fréquentes sur services
-- =====================================================

-- Index pour is_active (si pas déjà existant)
CREATE INDEX IF NOT EXISTS idx_services_is_active
ON services(is_active)
WHERE is_active = true;

-- Index pour les requêtes avec GPS (la table services utilise gps comme texte, pas latitude/longitude)
-- Note: Les coordonnées GPS sont stockées dans la colonne gps (format texte) ou extraites via fonctions
-- Cet index sera créé seulement si des colonnes latitude/longitude existent
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'services' 
        AND column_name = 'latitude'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'services' 
        AND column_name = 'longitude'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'services' 
            AND indexname = 'idx_services_location_gist'
        ) THEN
            CREATE INDEX idx_services_location_gist
            ON services USING GIST(ST_Point(longitude, latitude))
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND is_active = true;
        END IF;
    END IF;
END $$;

-- =====================================================
-- 7. ANALYSE et VACUUM pour optimiser les performances
-- =====================================================

-- Analyser les tables pour mettre à jour les statistiques
ANALYZE pharmacies;
ANALYZE services;
ANALYZE deliveries;
ANALYZE courier_profiles;
ANALYZE delivery_matching_queue;

-- Note: VACUUM ne peut pas être exécuté dans une transaction
-- Il faudra l'exécuter manuellement ou via un cron job:
-- VACUUM ANALYZE pharmacies;
-- VACUUM ANALYZE services;
-- VACUUM ANALYZE deliveries;
-- VACUUM ANALYZE courier_profiles;
-- VACUUM ANALYZE delivery_matching_queue;

-- =====================================================
-- 8. Configuration PostgreSQL pour améliorer les performances
-- =====================================================

-- Augmenter work_mem pour les requêtes complexes (session uniquement)
-- Note: Ces paramètres doivent être configurés au niveau du serveur PostgreSQL
-- Pour Render.com, vérifier les paramètres dans le dashboard
-- Recommandations:
-- - work_mem: 16MB (pour requêtes avec tri/joins)
-- - shared_buffers: 25% de RAM disponible
-- - effective_cache_size: 50-75% de RAM disponible
-- - maintenance_work_mem: 256MB (pour VACUUM/ANALYZE)

-- =====================================================
-- NOTES FINALES
-- =====================================================

-- Ces index devraient réduire significativement les temps d'exécution:
-- - pharmacies JOIN services: 1.68s → <200ms (attendu)
-- - delivery_matching_queue: 1.37s → <100ms (attendu)
-- - deliveries SELECT: 1.4-2.3s → <150ms (attendu)
-- - find_nearby_couriers: 2.1s → <300ms (attendu)

-- Les refreshes de vues matérialisées (8-15s) sont normaux pour de grandes tables
-- Ils utilisent déjà un pool séparé et sont exécutés en arrière-plan toutes les 15 minutes
-- Pour réduire davantage, considérer:
-- 1. Partitionner les tables sources
-- 2. Rafraîchir seulement les parties modifiées (incremental refresh)
-- 3. Utiliser pg_cron pour rafraîchir pendant les heures creuses


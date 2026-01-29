-- ============================================================================
-- Phase 1: Optimisations Critiques pour Scalabilité Livraison
-- Date: 2025-01-27
-- Objectif: Gérer des millions de livraisons simultanées
-- ============================================================================

-- ✅ CORRIGÉ 2026-01-29: Vérifier et créer le type ENUM si nécessaire
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_engine_type') THEN
        CREATE TYPE delivery_engine_type AS ENUM (
            'moto',
            'scooter',
            'voiture',
            'camionnette',
            'velo_cargo',
            'pieton',
            'camion_leger',
            'autre'
        );
    END IF;
END $$;

-- ============================================================================
-- 1. INDEX PARTIELS POUR LIVRAISONS ACTIVES
-- ============================================================================

-- Index partiel pour livraisons actives (statuts en cours)
-- Réduit significativement la taille de l'index et améliore les performances
CREATE INDEX IF NOT EXISTS idx_deliveries_active_status 
ON deliveries (status, requested_at DESC)
WHERE status IN ('requested', 'awaiting_courier_confirmation', 'accepted', 
                 'en_route_pickup', 'arrival_pickup', 'picked_up', 
                 'shopping_in_progress', 'shopping_completed', 
                 'en_route_delivery', 'arrival_destination');

-- Index composite pour matching coursier (requêtes fréquentes)
CREATE INDEX IF NOT EXISTS idx_deliveries_courier_status_time
ON deliveries (courier_id, status, requested_at DESC)
WHERE courier_id IS NOT NULL;

-- Index pour dashboard prestataire (créateur)
CREATE INDEX IF NOT EXISTS idx_deliveries_creator_dashboard
ON deliveries (creator_id, status, requested_at DESC)
INCLUDE (courier_id, distance_meters, delivered_at);

-- Index pour recherche par destinataire
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_active
ON deliveries (recipient_user_id, status, requested_at DESC)
WHERE recipient_user_id IS NOT NULL AND status != 'completed';

-- ============================================================================
-- 2. INDEX OPTIMISÉS POUR MATCHING COURSIER
-- ============================================================================

-- Index composite pour recherche coursiers disponibles par zone
CREATE INDEX IF NOT EXISTS idx_courier_availability_matching
ON courier_availability_snapshots (zone_id, is_online, load_factor, captured_at DESC)
WHERE is_online = TRUE AND load_factor < 1.0;

-- Index spatial pour recherche proximité (si PostGIS disponible)
-- Note: Vérifier que l'extension PostGIS est activée
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        -- Index spatial pour courier_availability_snapshots
        CREATE INDEX IF NOT EXISTS idx_courier_availability_location_spatial
        ON courier_availability_snapshots
        USING GIST (
            ST_MakePoint(longitude, latitude)
        )
        WHERE is_online = TRUE AND latitude IS NOT NULL AND longitude IS NOT NULL;
        
        RAISE NOTICE 'Index spatial créé pour courier_availability_snapshots';
    ELSE
        RAISE NOTICE 'PostGIS non disponible - Index spatial ignoré';
    END IF;
END $$;

-- Index pour matching queue (priorité + statut)
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_priority
ON delivery_matching_queue (status, priority DESC, next_attempt_at ASC)
WHERE status IN ('queued', 'searching');

-- ============================================================================
-- 3. FONCTION SQL OPTIMISÉE POUR RECHERCHE COURSIERS PROCHES
-- ============================================================================

-- Fonction pour trouver les coursiers proches d'un point de pickup
-- Utilise PostGIS si disponible, sinon formule Haversine
CREATE OR REPLACE FUNCTION find_nearby_couriers(
    p_pickup_lat FLOAT,
    p_pickup_lng FLOAT,
    p_radius_meters INTEGER DEFAULT 5000,
    p_max_results INTEGER DEFAULT 10,
    p_zone_id UUID DEFAULT NULL
)
RETURNS TABLE (
    courier_id UUID,
    user_id INTEGER,
    distance_meters FLOAT,
    load_factor NUMERIC,
    active_deliveries SMALLINT,
    max_capacity SMALLINT,
    engine_type delivery_engine_type,
    is_primary BOOLEAN
) 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Vérifier si PostGIS est disponible
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        -- Version optimisée avec PostGIS
        RETURN QUERY
        SELECT 
            cas.courier_id,
            c.user_id,
            ST_Distance(
                ST_MakePoint(p_pickup_lng, p_pickup_lat)::geography,
                ST_MakePoint(cas.longitude, cas.latitude)::geography
            )::FLOAT AS distance_meters,
            cas.load_factor,
            cas.active_deliveries,
            cas.max_capacity,
            ca.engine_type,
            ca.is_primary
        FROM courier_availability_snapshots cas
        INNER JOIN couriers c ON c.id = cas.courier_id
        LEFT JOIN courier_assets ca ON ca.courier_id = cas.courier_id AND ca.is_primary = TRUE
        WHERE cas.is_online = TRUE
          -- ✅ MODIFIÉ: Permettre les coursiers avec load_factor >= 1.0 (ils peuvent accepter plusieurs courses compatibles)
          -- La vérification de compatibilité se fera dans le code Rust
          AND cas.latitude IS NOT NULL
          AND cas.longitude IS NOT NULL
          AND (p_zone_id IS NULL OR cas.zone_id = p_zone_id)
          AND ST_DWithin(
              ST_MakePoint(cas.longitude, cas.latitude)::geography,
              ST_MakePoint(p_pickup_lng, p_pickup_lat)::geography,
              p_radius_meters
          )
          AND cas.captured_at >= NOW() - INTERVAL '5 minutes' -- Snapshots récents seulement
        ORDER BY distance_meters ASC, cas.load_factor ASC
        LIMIT p_max_results;
    ELSE
        -- Version avec formule Haversine (sans PostGIS)
        RETURN QUERY
        WITH nearby_couriers AS (
            SELECT 
                cas.courier_id,
                c.user_id,
                -- Formule Haversine simplifiée (approximation)
                (
                    6371000 * acos(
                        cos(radians(p_pickup_lat)) * 
                        cos(radians(cas.latitude)) * 
                        cos(radians(cas.longitude) - radians(p_pickup_lng)) + 
                        sin(radians(p_pickup_lat)) * 
                        sin(radians(cas.latitude))
                    )
                )::FLOAT AS distance_meters,
                cas.load_factor,
                cas.active_deliveries,
                cas.max_capacity,
                ca.engine_type,
                ca.is_primary
            FROM courier_availability_snapshots cas
            INNER JOIN couriers c ON c.id = cas.courier_id
            LEFT JOIN courier_assets ca ON ca.courier_id = cas.courier_id AND ca.is_primary = TRUE
            WHERE cas.is_online = TRUE
              -- ✅ MODIFIÉ: Permettre les coursiers avec load_factor >= 1.0 (ils peuvent accepter plusieurs courses compatibles)
              -- La vérification de compatibilité se fera dans le code Rust
              AND cas.latitude IS NOT NULL
              AND cas.longitude IS NOT NULL
              AND (p_zone_id IS NULL OR cas.zone_id = p_zone_id)
              AND cas.captured_at >= NOW() - INTERVAL '5 minutes'
        )
        SELECT 
            courier_id,
            user_id,
            distance_meters,
            load_factor,
            active_deliveries,
            max_capacity,
            engine_type,
            is_primary
        FROM nearby_couriers
        WHERE distance_meters <= p_radius_meters
        ORDER BY distance_meters ASC, load_factor ASC
        LIMIT p_max_results;
    END IF;
END;
$$;

-- Commentaire sur la fonction
COMMENT ON FUNCTION find_nearby_couriers IS 
'Recherche optimisée des coursiers proches d''un point de pickup. 
Utilise PostGIS si disponible, sinon formule Haversine.
Retourne les coursiers triés par distance et charge.';

-- ============================================================================
-- 4. INDEX POUR OPTIMISER LA FONCTION find_nearby_couriers
-- ============================================================================

-- Index sur captured_at pour filtrer les snapshots récents
CREATE INDEX IF NOT EXISTS idx_courier_availability_recent
ON courier_availability_snapshots (captured_at DESC)
WHERE is_online = TRUE AND load_factor < 1.0;

-- Index composite pour zone + online + load
CREATE INDEX IF NOT EXISTS idx_courier_availability_zone_online
ON courier_availability_snapshots (zone_id, is_online, load_factor, captured_at DESC)
WHERE is_online = TRUE;

-- ============================================================================
-- 5. INDEX POUR TRACKING POINTS (OPTIMISATION FUTURE)
-- ============================================================================

-- Index pour requêtes de tracking récentes (sans condition NOW() car non IMMUTABLE)
-- La condition de date sera gérée dans les requêtes SQL
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_points_recent
ON delivery_tracking_points (delivery_id, captured_at DESC);

-- Index pour analytics de tracking (sans condition NOW() car non IMMUTABLE)
-- La condition de date sera gérée dans les requêtes SQL
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_points_courier_time
ON delivery_tracking_points (courier_id, captured_at DESC);

-- ============================================================================
-- 6. STATISTIQUES POUR OPTIMISEUR POSTGRESQL
-- ============================================================================

-- Analyser les tables pour mettre à jour les statistiques
ANALYZE deliveries;
ANALYZE courier_availability_snapshots;
ANALYZE delivery_matching_queue;
ANALYZE delivery_tracking_points;

-- ============================================================================
-- 7. VUE MATÉRIALISÉE POUR STATS RAPIDES (OPTIONNEL)
-- ============================================================================

-- Vue matérialisée pour statistiques de livraisons actives
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_delivery_stats_active AS
SELECT 
    status,
    COUNT(*) AS count,
    AVG(distance_meters) AS avg_distance,
    AVG(EXTRACT(EPOCH FROM (NOW() - requested_at))/60) AS avg_age_minutes
FROM deliveries
WHERE status IN ('requested', 'awaiting_courier_confirmation', 'accepted', 
                'en_route_pickup', 'arrival_pickup', 'picked_up', 
                'shopping_in_progress', 'shopping_completed', 
                'en_route_delivery', 'arrival_destination')
GROUP BY status;

-- Index unique pour la vue matérialisée
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_delivery_stats_active_status
ON mv_delivery_stats_active (status);

-- Commentaire
COMMENT ON MATERIALIZED VIEW mv_delivery_stats_active IS 
'Statistiques en temps réel des livraisons actives. 
Rafraîchir périodiquement avec REFRESH MATERIALIZED VIEW CONCURRENTLY.';

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================


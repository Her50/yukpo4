-- Migration pour permettre aux coursiers d'accepter plusieurs courses compatibles
-- Date: 2026-01-27

-- ✅ MODIFIÉ: Mettre à jour la fonction find_nearby_couriers pour ne plus exclure les coursiers avec load_factor >= 1.0
-- Les coursiers peuvent maintenant accepter plusieurs courses si elles sont compatibles (même pickup ou sur trajectoire)
-- La vérification de compatibilité se fera dans le code Rust

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
          -- ✅ MODIFIÉ: Ne plus filtrer par load_factor < 1.0
          -- Les coursiers peuvent accepter plusieurs courses compatibles même si load_factor >= 1.0
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
              -- ✅ MODIFIÉ: Ne plus filtrer par load_factor < 1.0
              -- Les coursiers peuvent accepter plusieurs courses compatibles même si load_factor >= 1.0
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

COMMENT ON FUNCTION find_nearby_couriers IS 
'Retourne les coursiers disponibles près d''un point de pickup. 
✅ MODIFIÉ: Ne filtre plus par load_factor < 1.0 pour permettre aux coursiers d''accepter plusieurs courses compatibles.
La vérification de compatibilité (même pickup ou sur trajectoire) se fait dans le code Rust.';


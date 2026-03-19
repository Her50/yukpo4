-- ✅ Migration pour optimiser les requêtes deliveries lentes
-- Problème: Requêtes SELECT deliveries avec ST_Y/ST_X prennent 1.0s-1.9s
-- Solution: Ajouter colonnes calculées pour éviter les calculs géographiques à chaque requête

-- 2. Créer trigger pour mettre à jour automatiquement les coordonnées (fonction globale)
CREATE OR REPLACE FUNCTION update_delivery_coordinates()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pickup_location IS NOT NULL THEN
        NEW.pickup_lat := ST_Y(NEW.pickup_location::geometry);
        NEW.pickup_lng := ST_X(NEW.pickup_location::geometry);
    ELSE
        NEW.pickup_lat := NULL;
        NEW.pickup_lng := NULL;
    END IF;
    
    IF NEW.dropoff_location IS NOT NULL THEN
        NEW.dropoff_lat := ST_Y(NEW.dropoff_location::geometry);
        NEW.dropoff_lng := ST_X(NEW.dropoff_location::geometry);
    ELSE
        NEW.dropoff_lat := NULL;
        NEW.dropoff_lng := NULL;
    END IF;
    
    IF NEW.store_location IS NOT NULL THEN
        NEW.store_lat := ST_Y(NEW.store_location::geometry);
        NEW.store_lng := ST_X(NEW.store_location::geometry);
    ELSE
        NEW.store_lat := NULL;
        NEW.store_lng := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Protection: Vérifier que la table deliveries existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deliveries') THEN
        -- 1. Ajouter colonnes calculées pour éviter ST_Y/ST_X à chaque requête
        ALTER TABLE deliveries 
        ADD COLUMN IF NOT EXISTS pickup_lat FLOAT,
        ADD COLUMN IF NOT EXISTS pickup_lng FLOAT,
        ADD COLUMN IF NOT EXISTS dropoff_lat FLOAT,
        ADD COLUMN IF NOT EXISTS dropoff_lng FLOAT,
        ADD COLUMN IF NOT EXISTS store_lat FLOAT,
        ADD COLUMN IF NOT EXISTS store_lng FLOAT;

        -- 3. Créer le trigger (DROP IF EXISTS pour éviter erreur si existe déjà)
        DROP TRIGGER IF EXISTS delivery_coordinates_trigger ON deliveries;
        CREATE TRIGGER delivery_coordinates_trigger
        BEFORE INSERT OR UPDATE OF pickup_location, dropoff_location, store_location
        ON deliveries
        FOR EACH ROW
        EXECUTE FUNCTION update_delivery_coordinates();

        -- 4. Mettre à jour les enregistrements existants
        UPDATE deliveries 
        SET 
            pickup_lat = CASE WHEN pickup_location IS NOT NULL THEN ST_Y(pickup_location::geometry) ELSE NULL END,
            pickup_lng = CASE WHEN pickup_location IS NOT NULL THEN ST_X(pickup_location::geometry) ELSE NULL END,
            dropoff_lat = CASE WHEN dropoff_location IS NOT NULL THEN ST_Y(dropoff_location::geometry) ELSE NULL END,
            dropoff_lng = CASE WHEN dropoff_location IS NOT NULL THEN ST_X(dropoff_location::geometry) ELSE NULL END,
            store_lat = CASE WHEN store_location IS NOT NULL THEN ST_Y(store_location::geometry) ELSE NULL END,
            store_lng = CASE WHEN store_location IS NOT NULL THEN ST_X(store_location::geometry) ELSE NULL END
        WHERE pickup_lat IS NULL OR pickup_lng IS NULL OR dropoff_lat IS NULL OR dropoff_lng IS NULL;

        -- 8. Index pour optimiser les requêtes deliveries par ID (déjà présent mais on s'assure)
        CREATE INDEX IF NOT EXISTS idx_deliveries_id ON deliveries(id);

        -- 9. Index pour optimiser les requêtes deliveries par statut et updated_at
        CREATE INDEX IF NOT EXISTS idx_deliveries_status_updated_at 
        ON deliveries(status, updated_at) 
        WHERE status NOT IN ('delivered', 'cancelled', 'completed');

        COMMENT ON COLUMN deliveries.pickup_lat IS 'Latitude calculée depuis pickup_location (évite ST_Y à chaque requête)';
        COMMENT ON COLUMN deliveries.pickup_lng IS 'Longitude calculée depuis pickup_location (évite ST_X à chaque requête)';
        COMMENT ON COLUMN deliveries.dropoff_lat IS 'Latitude calculée depuis dropoff_location (évite ST_Y à chaque requête)';
        COMMENT ON COLUMN deliveries.dropoff_lng IS 'Longitude calculée depuis dropoff_location (évite ST_X à chaque requête)';
        COMMENT ON COLUMN deliveries.store_lat IS 'Latitude calculée depuis store_location (évite ST_Y à chaque requête)';
        COMMENT ON COLUMN deliveries.store_lng IS 'Longitude calculée depuis store_location (évite ST_X à chaque requête)';
    END IF;
END $$;

-- 5. Index pour delivery_matching_queue (optimiser UPDATE)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_matching_queue') THEN
        CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_delivery_id 
        ON delivery_matching_queue(delivery_id);
    END IF;
END $$;

-- 6. Index spatial pour courier_availability_snapshots (optimiser ST_Distance)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'courier_availability_snapshots') THEN
        CREATE INDEX IF NOT EXISTS idx_courier_availability_location_gist 
        ON courier_availability_snapshots USING GIST(location);

        -- 7. Index composite pour optimiser les recherches de coursiers disponibles
        CREATE INDEX IF NOT EXISTS idx_courier_availability_online_captured 
        ON courier_availability_snapshots(is_online, captured_at) 
        WHERE is_online = TRUE;
    END IF;
END $$;

-- Migration: Optimisation des performances de recherche
-- Date: 2026-01-14
-- Problèmes corrigés:
--   1. Requête publicites lente (1.136s) - manque d'index
--   2. UPDATE delivery_matching_queue lent (1.288s) - manque d'index
--   3. SELECT delivery_parcels avec sous-requête lente (436-765ms) - besoin d'index

-- 1. Index pour publicites (requête dans publicite_search_service.rs)
-- Optimise: SELECT ... FROM publicites WHERE status = 'active' AND date_fin > NOW() AND date_debut <= NOW()
-- Note: On ne peut pas utiliser NOW() dans WHERE d'un index partiel (pas IMMUTABLE)
-- L'index sera efficace même sans la condition date_fin > NOW() car PostgreSQL peut utiliser l'index pour filtrer
CREATE INDEX IF NOT EXISTS idx_publicites_active_filter 
ON publicites(date_fin DESC, date_debut DESC) 
WHERE status = 'active';

-- Index complémentaire pour status seul (si pas déjà existant)
CREATE INDEX IF NOT EXISTS idx_publicites_status 
ON publicites(status) 
WHERE status = 'active';

-- 2. Index pour delivery_matching_queue (UPDATE dans delivery_repository.rs)
-- Optimise: UPDATE delivery_matching_queue ... WHERE delivery_id = $1
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_delivery_id 
ON delivery_matching_queue(delivery_id);

-- 3. Index pour deliveries.parcel_id (optimise JOIN dans delivery_service.rs)
-- Optimise: SELECT dp.constraints FROM delivery_parcels dp INNER JOIN deliveries d ON d.parcel_id = dp.id WHERE d.id = $1
-- Protection: Vérifier que les tables existent
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deliveries') THEN
        CREATE INDEX IF NOT EXISTS idx_deliveries_parcel_id 
        ON deliveries(parcel_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_parcels') THEN
        -- Index complémentaire pour delivery_parcels.id (si pas déjà PRIMARY KEY)
        -- Note: Si id est PRIMARY KEY, cet index n'est pas nécessaire mais ne fait pas de mal
        CREATE INDEX IF NOT EXISTS idx_delivery_parcels_id 
        ON delivery_parcels(id);
    END IF;
END $$;

-- 4. Index pour service_products.service_id (si pas déjà existant)
-- Optimise: SELECT ... FROM service_products WHERE service_id = $1 AND is_active = TRUE
CREATE INDEX IF NOT EXISTS idx_service_products_service_id_active 
ON service_products(service_id, is_active) 
WHERE is_active = TRUE;

-- Vérification des index créés
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 20260114_optimize_search_performance appliquée avec succès';
    RAISE NOTICE 'Index créés:';
    RAISE NOTICE '  - idx_publicites_active_filter';
    RAISE NOTICE '  - idx_publicites_status';
    RAISE NOTICE '  - idx_delivery_matching_queue_delivery_id';
    RAISE NOTICE '  - idx_deliveries_parcel_id';
    RAISE NOTICE '  - idx_delivery_parcels_id';
    RAISE NOTICE '  - idx_service_products_service_id_active';
END $$;


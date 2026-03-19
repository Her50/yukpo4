-- ✅ Migration: Optimisations scalabilité Flash Sales et Black Friday
-- Date: 2025-01-28
-- Objectif: Index et vues matérialisées pour gérer des millions d'interactions simultanées

-- Index pour flash sales (protégés, sans CONCURRENTLY car SQLx utilise des transactions)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'live_flash_sales') THEN
        CREATE INDEX IF NOT EXISTS idx_flash_sales_status_start ON live_flash_sales(status, start_at) WHERE status IN ('scheduled', 'live');
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'live_flash_sale_reservations') THEN
        CREATE INDEX IF NOT EXISTS idx_flash_reservations_sale_user ON live_flash_sale_reservations(flash_sale_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_flash_reservations_sale_quantity ON live_flash_sale_reservations(flash_sale_id, quantity);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'global_promo_entries') THEN
        CREATE INDEX IF NOT EXISTS idx_global_promo_entries_event_status ON global_promo_entries(event_id, status) WHERE status IN ('approved', 'published');
        CREATE INDEX IF NOT EXISTS idx_global_promo_entries_service ON global_promo_entries(service_id) WHERE status IN ('approved', 'published');
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'global_promo_products')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'global_promo_products' AND column_name = 'highlighted')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'global_promo_products' AND column_name = 'priority_score') THEN
        CREATE INDEX IF NOT EXISTS idx_global_promo_products_highlighted_priority ON global_promo_products(highlighted DESC, priority_score DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'global_promo_events') THEN
        CREATE INDEX IF NOT EXISTS idx_global_promo_events_status_dates ON global_promo_events(status, starts_at, ends_at) WHERE status IN ('scheduled', 'live');
        CREATE INDEX IF NOT EXISTS idx_global_promo_events_search ON global_promo_events USING gin(to_tsvector('french', display_name || ' ' || COALESCE(theme, '')));
    END IF;
END $$;

-- Vue matérialisée pour le catalogue (refresh toutes les 30 secondes) (protégée)
-- Note: Création simplifiée sans colonnes optionnelles pour éviter les erreurs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'global_promo_entries')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'global_promo_events') THEN
        -- Version simplifiée avec seulement les colonnes de base
        DROP MATERIALIZED VIEW IF EXISTS global_promo_catalog_cache;
        CREATE MATERIALIZED VIEW global_promo_catalog_cache AS
        SELECT
            e.id AS entry_id,
            e.event_id,
            e.service_id,
            e.discount_percentage,
            e.promo_price_cfa,
            e.stock_cap,
            e.availability,
            e.status AS entry_status,
            ev.id AS event_id_alias,
            ev.slug AS event_slug,
            ev.theme AS event_theme,
            ev.display_name AS event_display_name,
            ev.starts_at AS event_starts_at,
            ev.ends_at AS event_ends_at,
            ev.status AS event_status,
            gp.id AS product_id
        FROM global_promo_entries e
        JOIN global_promo_events ev ON ev.id = e.event_id
        LEFT JOIN global_promo_products gp ON gp.promo_entry_id = e.id
        WHERE ev.status IN ('scheduled', 'live')
          AND e.status IN ('approved', 'published')
          AND ev.ends_at >= NOW();

        CREATE UNIQUE INDEX IF NOT EXISTS idx_global_promo_catalog_cache_entry_id ON global_promo_catalog_cache(entry_id);
        CREATE INDEX IF NOT EXISTS idx_global_promo_catalog_cache_starts_at ON global_promo_catalog_cache(event_starts_at);
        CREATE INDEX IF NOT EXISTS idx_global_promo_catalog_cache_ends_at ON global_promo_catalog_cache(event_ends_at);
    END IF;
END $$;

-- Commentaires pour documentation (protégés)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_flash_sales_status_start') THEN
        EXECUTE 'COMMENT ON INDEX idx_flash_sales_status_start IS ''Optimise les requêtes de flash sales actives''';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_flash_reservations_sale_user') THEN
        EXECUTE 'COMMENT ON INDEX idx_flash_reservations_sale_user IS ''Optimise les vérifications de réservations utilisateur''';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_global_promo_entries_event_status') THEN
        EXECUTE 'COMMENT ON INDEX idx_global_promo_entries_event_status IS ''Optimise les requêtes de catalogue par événement''';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_global_promo_products_highlighted_priority') THEN
        EXECUTE 'COMMENT ON INDEX idx_global_promo_products_highlighted_priority IS ''Optimise le tri par priorité et mise en avant''';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'global_promo_catalog_cache') THEN
        EXECUTE 'COMMENT ON MATERIALIZED VIEW global_promo_catalog_cache IS ''Cache matérialisé pour le catalogue Black Friday (refresh toutes les 30s)''';
    END IF;
END $$;


-- ✅ Migration: Optimisations scalabilité Flash Sales et Black Friday
-- Date: 2025-01-28
-- Objectif: Index et vues matérialisées pour gérer des millions d'interactions simultanées

-- Index pour flash sales
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flash_sales_status_start 
ON live_flash_sales(status, start_at) 
WHERE status IN ('scheduled', 'live');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flash_reservations_sale_user 
ON live_flash_sale_reservations(flash_sale_id, user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flash_reservations_sale_quantity 
ON live_flash_sale_reservations(flash_sale_id, quantity);

-- Index pour Black Friday / Global Promo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_entries_event_status 
ON global_promo_entries(event_id, status) 
WHERE status IN ('approved', 'published');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_entries_service 
ON global_promo_entries(service_id) 
WHERE status IN ('approved', 'published');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_products_highlighted_priority 
ON global_promo_products(highlighted DESC, priority_score DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_events_status_dates 
ON global_promo_events(status, starts_at, ends_at) 
WHERE status IN ('scheduled', 'live');

-- Index full-text pour recherche (si PostgreSQL >= 12)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_events_search 
ON global_promo_events USING gin(to_tsvector('french', display_name || ' ' || COALESCE(theme, '')));

-- Vue matérialisée pour le catalogue (refresh toutes les 30 secondes)
CREATE MATERIALIZED VIEW IF NOT EXISTS global_promo_catalog_cache AS
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
    gp.id AS product_id,
    gp.priority_score AS product_priority_score,
    gp.highlighted AS product_highlighted,
    gp.snapshot AS product_snapshot
FROM global_promo_entries e
JOIN global_promo_events ev ON ev.id = e.event_id
LEFT JOIN global_promo_products gp ON gp.promo_entry_id = e.id
WHERE ev.status IN ('scheduled', 'live')
  AND e.status IN ('approved', 'published')
  AND ev.ends_at >= NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_promo_catalog_cache_entry_id ON global_promo_catalog_cache(entry_id);
CREATE INDEX IF NOT EXISTS idx_global_promo_catalog_cache_highlighted_priority ON global_promo_catalog_cache(product_highlighted DESC, product_priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_global_promo_catalog_cache_starts_at ON global_promo_catalog_cache(event_starts_at);
CREATE INDEX IF NOT EXISTS idx_global_promo_catalog_cache_ends_at ON global_promo_catalog_cache(event_ends_at);

-- Commentaires pour documentation
COMMENT ON INDEX idx_flash_sales_status_start IS 'Optimise les requêtes de flash sales actives';
COMMENT ON INDEX idx_flash_reservations_sale_user IS 'Optimise les vérifications de réservations utilisateur';
COMMENT ON INDEX idx_global_promo_entries_event_status IS 'Optimise les requêtes de catalogue par événement';
COMMENT ON INDEX idx_global_promo_products_highlighted_priority IS 'Optimise le tri par priorité et mise en avant';
COMMENT ON MATERIALIZED VIEW global_promo_catalog_cache IS 'Cache matérialisé pour le catalogue Black Friday (refresh toutes les 30s)';


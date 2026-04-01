-- Migration: index de performance pour la recherche universelle cross-services
-- GET /api/search/universal?q=...
-- Les 3 sources utilisent ILIKE sur des champs texte — sans index trigram, chaque requête fait un full-scan.

-- Extension pg_trgm (trigram) nécessaire pour les index GIN ILIKE
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────────
-- 1. service_products → product_name + description
-- ─────────────────────────────────────────────
-- product_name est une colonne générée (stored) — indexable directement
CREATE INDEX IF NOT EXISTS idx_service_products_name_trgm
    ON service_products USING GIN (product_name gin_trgm_ops);

-- description est dans product_data JSONB — index d'expression
CREATE INDEX IF NOT EXISTS idx_service_products_data_desc_trgm
    ON service_products USING GIN ((product_data->>'description') gin_trgm_ops)
    WHERE product_data->>'description' IS NOT NULL;

-- Index composite pour filtrage par is_active + service_id
CREATE INDEX IF NOT EXISTS idx_service_products_active_service
    ON service_products (service_id)
    WHERE is_active = true;

-- ─────────────────────────────────────────────
-- 2. restaurant_menu_items → nom + description
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_nom_trgm
    ON restaurant_menu_items USING GIN (nom gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_description_trgm
    ON restaurant_menu_items USING GIN (description gin_trgm_ops);

-- NOTE: colonne is_disponible (pas est_disponible)
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_disponible
    ON restaurant_menu_items (service_id)
    WHERE is_disponible = true;

-- ─────────────────────────────────────────────
-- 3. services → data JSONB (nom, description, adresse)
-- ─────────────────────────────────────────────

-- Index expression sur le nom extrait du JSONB (le plus utilisé)
CREATE INDEX IF NOT EXISTS idx_services_data_nom_trgm
    ON services USING GIN ((data->>'nom') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_data_description_trgm
    ON services USING GIN ((data->>'description') gin_trgm_ops);

-- Index sur category pour le filtrage par type de service
CREATE INDEX IF NOT EXISTS idx_services_category
    ON services (category)
    WHERE category IS NOT NULL;

-- Index sur specialized_type pour les deep_link mappings
CREATE INDEX IF NOT EXISTS idx_services_specialized_type
    ON services (specialized_type)
    WHERE specialized_type IS NOT NULL;

-- Index GPS (gps column) pour accélérer le parsing distance
-- Note: si PostGIS est disponible, privilégier geometry index — sinon cet index partiel suffit
CREATE INDEX IF NOT EXISTS idx_services_gps_notnull
    ON services (gps)
    WHERE gps IS NOT NULL AND gps != '';

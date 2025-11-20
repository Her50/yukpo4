-- Migration: Gestion de stock en temps réel
-- Date: 2025-01-20

-- 1. Table stock par lieu
CREATE TABLE IF NOT EXISTS product_stock_locations (
    id SERIAL PRIMARY KEY,
    product_delivery_config_id INTEGER NOT NULL REFERENCES product_delivery_config(id) ON DELETE CASCADE,
    storage_location_id INTEGER REFERENCES merchant_storage_locations(id),
    quantity_available INTEGER DEFAULT 0,
    quantity_reserved INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(product_delivery_config_id, storage_location_id)
);

-- 2. Index pour product_stock_locations
CREATE INDEX IF NOT EXISTS idx_product_stock_locations_config 
ON product_stock_locations(product_delivery_config_id);

CREATE INDEX IF NOT EXISTS idx_product_stock_locations_available 
ON product_stock_locations(is_available, quantity_available) 
WHERE is_available = TRUE;

-- 3. Table réservations stock
CREATE TABLE IF NOT EXISTS stock_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    stock_location_id INTEGER NOT NULL REFERENCES product_stock_locations(id),
    quantity INTEGER NOT NULL,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL
);

-- 4. Index pour stock_reservations
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order 
ON stock_reservations(order_id);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires 
ON stock_reservations(expires_at) WHERE released_at IS NULL;


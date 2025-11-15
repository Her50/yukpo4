-- Synchronisation des stocks produits (overrides temps réel)
CREATE TABLE IF NOT EXISTS service_inventory_overrides (
    id BIGSERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    stock_level INTEGER NOT NULL,
    source TEXT,
    note TEXT,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_inventory_overrides_unique
    ON service_inventory_overrides(service_id, product_index);

CREATE INDEX IF NOT EXISTS idx_service_inventory_overrides_last_synced
    ON service_inventory_overrides(last_synced_at DESC);


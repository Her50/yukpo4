-- Piste 5 — Audit + idempotency des événements inventaire reçus de YukpoShop
-- (et plus tard d'autres sources). UNIQUE(event_id) bloque le double processing.

CREATE TABLE IF NOT EXISTS yukposhop_inventory_events (
    id                 BIGSERIAL PRIMARY KEY,
    event_id           UUID         NOT NULL UNIQUE,
    source_app         VARCHAR(40)  NOT NULL,
    external_id        VARCHAR(120) NOT NULL,
    rust_service_id    INTEGER      REFERENCES services(id) ON DELETE SET NULL,
    delta              INTEGER      NOT NULL,           -- < 0 = décrément, > 0 = restock
    raison             VARCHAR(80),                      -- order_yukposhop, restock_manuel, etc.
    order_numero       VARCHAR(60),
    new_stock_after    INTEGER,                          -- stock après application
    payload_jsonb      JSONB        NOT NULL,
    processed_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yukposhop_inv_events_service
    ON yukposhop_inventory_events(rust_service_id, processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_yukposhop_inv_events_source_ext
    ON yukposhop_inventory_events(source_app, external_id);

-- Migration: QR codes pour commandes restaurant + frais livraison/assurance sur restaurant_orders
-- Date: 2026-04-01

-- Table QR codes pour les commandes restaurant (livraison)
CREATE TABLE IF NOT EXISTS restaurant_order_qr_codes (
    id               SERIAL PRIMARY KEY,
    order_id         INTEGER NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
    qr_code          TEXT NOT NULL UNIQUE,
    qr_code_url      TEXT,
    qr_type          TEXT NOT NULL DEFAULT 'delivery', -- 'pickup' (coursier←restaurant) ou 'delivery' (client←coursier)
    status           TEXT NOT NULL DEFAULT 'pending',  -- pending, validated, expired
    expires_at       TIMESTAMPTZ NOT NULL,
    validated_at     TIMESTAMPTZ,
    validated_by     INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_order_qr_order_id ON restaurant_order_qr_codes(order_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_order_qr_code ON restaurant_order_qr_codes(qr_code);

-- Colonnes frais de livraison et assurance sur restaurant_orders
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS delivery_fee_cents     INTEGER DEFAULT 0;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS insurance_fee_cents    INTEGER DEFAULT 0;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS total_with_fees_cents  INTEGER;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS delivery_address       TEXT;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS client_rating          SMALLINT; -- 1-5, noté après livraison
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS client_rating_comment  TEXT;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS rated_at               TIMESTAMPTZ;

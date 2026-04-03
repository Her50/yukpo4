-- Migration: QR codes pour commandes pharmacie + coursier_id
-- Date: 2026-04-03
-- Pattern identique à restaurant_order_qr_codes

-- Table QR codes pour les commandes pharmacie
CREATE TABLE IF NOT EXISTS pharmacy_order_qr_codes (
    id           SERIAL PRIMARY KEY,
    order_id     UUID NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
    qr_code      TEXT NOT NULL UNIQUE,
    qr_code_url  TEXT,
    -- 'pickup'   : coursier montre ce QR à la pharmacie → pharmacie scanne pour valider la remise des médicaments
    -- 'delivery' : patient montre ce QR au coursier → coursier scanne pour valider la livraison
    qr_type      TEXT NOT NULL DEFAULT 'pickup',
    status       TEXT NOT NULL DEFAULT 'pending',   -- pending | validated | expired
    expires_at   TIMESTAMPTZ NOT NULL,
    validated_at TIMESTAMPTZ,
    validated_by INTEGER,                            -- user_id du validateur
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_order_qr_order_id ON pharmacy_order_qr_codes(order_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_order_qr_code     ON pharmacy_order_qr_codes(qr_code);
CREATE INDEX IF NOT EXISTS idx_pharmacy_order_qr_type     ON pharmacy_order_qr_codes(order_id, qr_type);

-- Coursier assigné à une commande pharmacie (FK souple vers delivery_couriers)
ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS courier_id UUID;

-- Index sur courier_id pour retrouver rapidement les commandes d'un coursier
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_courier_id ON pharmacy_orders(courier_id);

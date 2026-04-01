-- 2026-03-31
-- Convergence "medicament dispo + pharmacie proche + commande fiable"

-- Idempotency key pour eviter les doubles commandes
ALTER TABLE pharmacy_orders
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pharmacy_orders_user_idempotency
    ON pharmacy_orders(user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Reservation liee/consommee par commande
ALTER TABLE pharmacy_medication_reservations
    ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES pharmacy_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_order_id
    ON pharmacy_medication_reservations(order_id);

-- Index utilitaires pour recherche nearby + filtrage disponibilite
CREATE INDEX IF NOT EXISTS idx_pharmacy_products_name_lower
    ON pharmacy_products (LOWER(nom_produit));

CREATE INDEX IF NOT EXISTS idx_pharmacy_products_available
    ON pharmacy_products (pharmacy_service_id, disponible, stock);

-- Alignement produits ticket_voyage ↔ horaires agency_departure_schedules
-- Permet la génération de lignes products datées pour alimenter search_bus_tickets_with_availability

ALTER TABLE products ADD COLUMN IF NOT EXISTS depart TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS date_depart TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES agences_voyage(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_schedule_id TEXT REFERENCES agency_departure_schedules(id) ON DELETE SET NULL;

COMMENT ON COLUMN products.depart IS 'Ville départ (recherche billets bus)';
COMMENT ON COLUMN products.destination IS 'Ville arrivée (recherche billets bus)';
COMMENT ON COLUMN products.date_depart IS 'Date/heure départ du voyage (recherche + réservation)';
COMMENT ON COLUMN products.price IS 'Prix affiché/recherche (XAF), aligné avec ticket_price SQL';
COMMENT ON COLUMN products.user_id IS 'Référence agences_voyage.id (jointure recherche billets)';
COMMENT ON COLUMN products.source_schedule_id IS 'Si généré depuis une plage horaire récurrente';
COMMENT ON COLUMN products.is_active IS 'Produit visible dans la recherche si true';

CREATE INDEX IF NOT EXISTS idx_products_ticket_voyage_search
ON products (type, is_active, date_depart)
WHERE type = 'ticket_voyage' AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_schedule_departure
ON products (source_schedule_id, date_depart)
WHERE source_schedule_id IS NOT NULL AND type = 'ticket_voyage';

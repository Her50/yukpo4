-- Heure d'arrivée demandée par le client lors de la commande.
-- Permet au restaurant de planifier la préparation pour qu'elle soit prête à temps.
-- NULL = "tout de suite" (préparation immédiate).

ALTER TABLE restaurant_orders
    ADD COLUMN IF NOT EXISTS requested_arrival_time TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_arrival_time
    ON restaurant_orders (service_id, requested_arrival_time)
    WHERE requested_arrival_time IS NOT NULL AND status NOT IN ('completed', 'cancelled');

COMMENT ON COLUMN restaurant_orders.requested_arrival_time IS
    'Heure d''arrivée souhaitée par le client (UTC). NULL = préparation immédiate.';

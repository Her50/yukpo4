-- Phase A : confirmation d'arrivée par le client.
-- Le client clique "Je suis en route" entre T-30min et T-5min avant son arrivée.
-- NULL = pas encore confirmé. Sert de signal au restaurateur pour démarrer la prép.
ALTER TABLE restaurant_orders
    ADD COLUMN IF NOT EXISTS arrival_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_arrival_confirmed
    ON restaurant_orders (service_id, arrival_confirmed_at)
    WHERE arrival_confirmed_at IS NOT NULL;

COMMENT ON COLUMN restaurant_orders.arrival_confirmed_at IS
    'Horodatage où le client a confirmé sa venue. NULL = pas encore confirmé.';

-- Phase B : tracking no-show client (anti-fraude commandes restaurant).
-- Compteur incrémenté quand le restaurateur marque une commande "no-show".
-- Permet d'afficher un badge "Client à risque" au partenaire pour les futurs orders.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS restaurant_no_show_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS restaurant_no_show_last_at TIMESTAMPTZ;

COMMENT ON COLUMN users.restaurant_no_show_count IS
    'Nombre cumulé de no-shows restaurant (commande prise mais client pas venu).';

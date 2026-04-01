-- ============================================================
-- Module restaurant — menu, horaires, commandes
-- Complète 20260331_003_restaurant_operations.sql
-- ============================================================

-- Items du menu
CREATE TABLE IF NOT EXISTS restaurant_menu_items (
    id          SERIAL PRIMARY KEY,
    service_id  INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    nom         TEXT NOT NULL,
    description TEXT,
    prix        NUMERIC(12,2) NOT NULL DEFAULT 0,
    categorie   TEXT NOT NULL DEFAULT 'plat',  -- entree|plat|dessert|boisson|specialite
    is_disponible BOOLEAN NOT NULL DEFAULT TRUE,
    image_url   TEXT,
    availability_days JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]'::jsonb,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_menu_service  ON restaurant_menu_items(service_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_dispo    ON restaurant_menu_items(service_id) WHERE is_disponible = TRUE;

-- Horaires d'ouverture (0=Dim, 1=Lun … 6=Sam)
CREATE TABLE IF NOT EXISTS restaurant_opening_hours (
    id          SERIAL PRIMARY KEY,
    service_id  INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time   TIME,
    close_time  TIME,
    is_closed   BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_restaurant_opening_hours UNIQUE (service_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_hours_service ON restaurant_opening_hours(service_id);

-- Commandes restaurant (dine-in / à emporter / livraison)
CREATE TABLE IF NOT EXISTS restaurant_orders (
    id              SERIAL PRIMARY KEY,
    service_id      INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    client_user_id  INTEGER REFERENCES users(id),
    order_type      TEXT NOT NULL DEFAULT 'dine_in', -- dine_in|takeaway|delivery
    table_id        INTEGER REFERENCES restaurant_tables(id),
    status          TEXT NOT NULL DEFAULT 'pending',
                        -- pending|accepted|preparing|ready|completed|cancelled
    total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes           TEXT,
    client_name     TEXT,
    client_phone    TEXT,
    estimated_ready_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_service  ON restaurant_orders(service_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_client   ON restaurant_orders(client_user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_status   ON restaurant_orders(service_id, status);

-- Colonnes financières et livraison sur restaurant_orders
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS yukpo_commission    NUMERIC(12,2) DEFAULT 0;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS net_partner_amount  NUMERIC(12,2) DEFAULT 0;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS payment_status      TEXT NOT NULL DEFAULT 'unpaid'; -- unpaid|paid|refunded
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS payment_method      TEXT;        -- wallet|momo|orange_money|card|cash
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS delivery_order_id   INTEGER;     -- lien vers delivery_orders si livraison
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS delivery_address    TEXT;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS delivery_lat        DOUBLE PRECISION;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS delivery_lon        DOUBLE PRECISION;

-- Taux de commission Yukpo restaurant (configurable par admin, défaut 5%)
CREATE TABLE IF NOT EXISTS yukpo_commission_config (
    id             SERIAL PRIMARY KEY,
    service_type   TEXT NOT NULL UNIQUE,   -- 'restaurant', 'supermarche', etc.
    rate           NUMERIC(5,4) NOT NULL DEFAULT 0.05,  -- 5%
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO yukpo_commission_config (service_type, rate) VALUES ('restaurant', 0.05)
    ON CONFLICT (service_type) DO NOTHING;

-- Lignes de commande
CREATE TABLE IF NOT EXISTS restaurant_order_items (
    id            SERIAL PRIMARY KEY,
    order_id      INTEGER NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
    menu_item_id  INTEGER REFERENCES restaurant_menu_items(id),
    item_name     TEXT NOT NULL,
    item_price    NUMERIC(12,2) NOT NULL,
    quantity      INTEGER NOT NULL DEFAULT 1,
    notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_order ON restaurant_order_items(order_id);

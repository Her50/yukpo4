-- Migration: Course supermarché (shopping orders)
-- Date: 2025-11-10
\c yukpo_db;

-- Ajouter nouveaux statuts pour les livraisons
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'shopping_in_progress' AND enumtypid = 'delivery_status'::regtype
    ) THEN
        ALTER TYPE delivery_status ADD VALUE 'shopping_in_progress';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'shopping_completed' AND enumtypid = 'delivery_status'::regtype
    ) THEN
        ALTER TYPE delivery_status ADD VALUE 'shopping_completed';
    END IF;
END
$$;

-- Créer enums shopping
DO $$
BEGIN
    CREATE TYPE shopping_status AS ENUM (
        'pending',
        'awaiting_purchase',
        'shopping_in_progress',
        'shopping_completed',
        'checkout_submitted',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE shopping_item_status AS ENUM (
        'pending',
        'purchased',
        'missing',
        'replaced'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- Colonnes supplémentaires sur deliveries et delivery_pricing
ALTER TABLE deliveries
    ADD COLUMN IF NOT EXISTS shopping_required BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS store_location GEOGRAPHY(Point, 4326),
    ADD COLUMN IF NOT EXISTS store_name TEXT;

ALTER TABLE delivery_pricing
    ADD COLUMN IF NOT EXISTS shopping_cost_cents INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shopping_discount_cents INTEGER DEFAULT 0;

-- Table shopping_orders
CREATE TABLE IF NOT EXISTS shopping_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    status shopping_status NOT NULL DEFAULT 'pending',
    estimated_total_cents INTEGER NOT NULL DEFAULT 0,
    actual_total_cents INTEGER,
    currency CHAR(3) DEFAULT 'XAF',
    store_name TEXT,
    store_location GEOGRAPHY(Point, 4326),
    notes TEXT,
    requires_balance_top_up BOOLEAN DEFAULT FALSE,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_orders_status ON shopping_orders(status);

-- Table shopping_order_items
CREATE TABLE IF NOT EXISTS shopping_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopping_order_id UUID NOT NULL REFERENCES shopping_orders(id) ON DELETE CASCADE,
    product_id UUID,
    product_name TEXT NOT NULL,
    characteristics JSONB DEFAULT '[]'::jsonb,
    quantity NUMERIC(10,2) NOT NULL,
    unit TEXT DEFAULT 'unite',
    estimated_price_cents INTEGER DEFAULT 0,
    actual_price_cents INTEGER,
    status shopping_item_status NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_order_items_order ON shopping_order_items(shopping_order_id);
CREATE INDEX IF NOT EXISTS idx_shopping_order_items_status ON shopping_order_items(status);


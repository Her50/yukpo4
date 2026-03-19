-- Migration: Course supermarché (shopping orders)
-- Date: 2025-11-10

-- ✅ CORRIGÉ 2026-01-29: Vérifier que delivery_status existe avant d'ajouter des valeurs
DO $$
BEGIN
    -- Créer delivery_status s'il n'existe pas
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
        CREATE TYPE delivery_status AS ENUM (
            'requested',
            'awaiting_courier_confirmation',
            'accepted',
            'en_route_pickup',
            'arrival_pickup',
            'picked_up',
            'en_route_delivery',
            'arrival_destination',
            'delivered',
            'completed',
            'cancelled'
        );
    END IF;
    
    -- Ajouter nouveaux statuts pour les livraisons (seulement si le type existe)
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'shopping_in_progress' AND enumtypid = 'delivery_status'::regtype
        ) THEN
            BEGIN
                ALTER TYPE delivery_status ADD VALUE 'shopping_in_progress';
            EXCEPTION
                WHEN OTHERS THEN
                    -- Ignorer si l'ajout échoue (type utilisé dans une table)
                    NULL;
            END;
        END IF;
    END IF;
END
$$;

DO $$
BEGIN
    -- Ajouter shopping_completed seulement si delivery_status existe
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'shopping_completed' AND enumtypid = 'delivery_status'::regtype
        ) THEN
            BEGIN
                ALTER TYPE delivery_status ADD VALUE 'shopping_completed';
            EXCEPTION
                WHEN OTHERS THEN
                    -- Ignorer si l'ajout échoue (type utilisé dans une table)
                    NULL;
            END;
        END IF;
    END IF;
END
$$;

-- Créer enums shopping
-- ✅ CORRIGÉ 2026-01-29: Vérifier l'existence avant de créer
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shopping_status') THEN
        CREATE TYPE shopping_status AS ENUM (
            'pending',
            'awaiting_purchase',
            'shopping_in_progress',
            'shopping_completed',
            'checkout_submitted',
            'cancelled'
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shopping_item_status') THEN
        CREATE TYPE shopping_item_status AS ENUM (
            'pending',
            'purchased',
            'missing',
            'replaced'
        );
    END IF;
END $$;

-- Colonnes supplémentaires sur deliveries et delivery_pricing
-- ✅ CORRIGÉ 2026-01-29: Vérifier que les tables existent avant de les modifier
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deliveries') THEN
        ALTER TABLE deliveries
            ADD COLUMN IF NOT EXISTS shopping_required BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS store_location GEOGRAPHY(Point, 4326),
            ADD COLUMN IF NOT EXISTS store_name TEXT;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_pricing') THEN
        ALTER TABLE delivery_pricing
            ADD COLUMN IF NOT EXISTS shopping_cost_cents INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS shopping_discount_cents INTEGER DEFAULT 0;
    END IF;
END $$;

-- Table shopping_orders
-- ✅ CORRIGÉ 2026-01-29: Créer la table sans contrainte FK d'abord, puis l'ajouter conditionnellement
CREATE TABLE IF NOT EXISTS shopping_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID UNIQUE,
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

-- ✅ CORRIGÉ 2026-01-29: Ajouter la contrainte de clé étrangère seulement si deliveries existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deliveries') THEN
        -- Ajouter la contrainte de clé étrangère si elle n'existe pas
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = 'shopping_orders' 
            AND constraint_name = 'shopping_orders_delivery_id_fkey'
        ) THEN
            ALTER TABLE shopping_orders
                ADD CONSTRAINT shopping_orders_delivery_id_fkey
                FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

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


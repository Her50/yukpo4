-- ✅ NOUVEAU: Migration commandes pharmacie + réservations
-- Objectif: remplacer les stubs /api/pharmacies/{id}/order et /api/pharmacies/my-orders

-- Extensions requises (souvent déjà présentes)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Commandes de pharmacie (client)
CREATE TABLE IF NOT EXISTS pharmacy_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled')),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    delivery_method VARCHAR(20) NOT NULL DEFAULT 'pickup' CHECK (delivery_method IN ('pickup', 'delivery')),
    delivery_address TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_pharmacy_id ON pharmacy_orders(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_user_id ON pharmacy_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_status ON pharmacy_orders(status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_created_at ON pharmacy_orders(created_at DESC);

-- Items d'une commande (on garde medication_name pour compat mobile)
CREATE TABLE IF NOT EXISTS pharmacy_order_items (
    id SERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES pharmacy_products(id) ON DELETE SET NULL,
    medication_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_order ON pharmacy_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_product ON pharmacy_order_items(product_id);

-- Réservations de médicaments (optionnel pour retrait)
CREATE TABLE IF NOT EXISTS pharmacy_medication_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES pharmacy_products(id) ON DELETE SET NULL,
    medication_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'fulfilled')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_pharmacy ON pharmacy_medication_reservations(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_user ON pharmacy_medication_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_expires ON pharmacy_medication_reservations(expires_at);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_pharmacy_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pharmacy_orders_updated_at ON pharmacy_orders;
CREATE TRIGGER trigger_update_pharmacy_orders_updated_at
    BEFORE UPDATE ON pharmacy_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_pharmacy_orders_updated_at();


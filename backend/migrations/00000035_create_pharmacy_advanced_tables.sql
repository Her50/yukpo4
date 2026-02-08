-- Migration: Tables avancées pour Pharmacies
-- Date: 2025-01-27
-- Description: Tables pour commandes, réservations et analytics
-- Compatible SQLx offline mode

-- ============================================================================
-- 1. TABLE : Commandes de médicaments
-- ============================================================================
CREATE TABLE IF NOT EXISTS pharmacy_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prescription_id UUID, -- Lien vers prescription si applicable
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    delivery_address TEXT,
    delivery_method VARCHAR(20) NOT NULL DEFAULT 'pickup' CHECK (delivery_method IN ('pickup', 'delivery')),
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    payment_method VARCHAR(50),
    notes TEXT, -- Notes du client
    prepared_at TIMESTAMPTZ, -- Heure de préparation
    ready_at TIMESTAMPTZ, -- Heure de disponibilité
    delivered_at TIMESTAMPTZ, -- Heure de livraison/récupération
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_pharmacy ON pharmacy_orders(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_user ON pharmacy_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_status ON pharmacy_orders(status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_created ON pharmacy_orders(created_at);

-- ============================================================================
-- 2. TABLE : Détails des commandes (médicaments dans chaque commande)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pharmacy_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES pharmacy_products(id) ON DELETE CASCADE,
    medication_name VARCHAR(200) NOT NULL, -- Nom du médicament (copié pour historique)
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    requires_prescription BOOLEAN DEFAULT FALSE,
    prescription_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_order ON pharmacy_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_medication ON pharmacy_order_items(medication_id);

-- ============================================================================
-- 3. TABLE : Réservations de médicaments
-- ============================================================================
CREATE TABLE IF NOT EXISTS pharmacy_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES pharmacy_products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'collected', 'expired', 'cancelled')),
    expiry_time TIMESTAMPTZ NOT NULL, -- Date limite de validité de la réservation
    collected_at TIMESTAMPTZ, -- Heure de retrait
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_pharmacy ON pharmacy_reservations(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_user ON pharmacy_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_medication ON pharmacy_reservations(medication_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_status ON pharmacy_reservations(status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_expiry ON pharmacy_reservations(expiry_time) WHERE status = 'pending';

-- ============================================================================
-- 4. TABLE : Analytics des pharmacies
-- ============================================================================
CREATE TABLE IF NOT EXISTS pharmacy_analytics (
    id SERIAL PRIMARY KEY,
    pharmacy_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    -- Métriques commandes
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    -- Métriques revenus
    total_revenue DECIMAL(10,2) DEFAULT 0,
    delivery_revenue DECIMAL(10,2) DEFAULT 0,
    pickup_revenue DECIMAL(10,2) DEFAULT 0,
    -- Métriques stock
    low_stock_alerts INTEGER DEFAULT 0, -- Nombre d'alertes stock bas
    out_of_stock_items INTEGER DEFAULT 0, -- Nombre d'articles en rupture
    -- Satisfaction
    avg_rating DECIMAL(3,2), -- Note moyenne sur 5
    total_ratings INTEGER DEFAULT 0,
    -- Temps de préparation moyen
    avg_preparation_time_minutes DECIMAL(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pharmacy_id, date)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_analytics_pharmacy ON pharmacy_analytics(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_analytics_date ON pharmacy_analytics(date);

-- ============================================================================
-- 5. FONCTIONS : Calcul automatique des statistiques
-- ============================================================================

-- Fonction pour calculer le temps de préparation moyen
CREATE OR REPLACE FUNCTION calculate_pharmacy_avg_preparation_time(pharmacy_id_param INTEGER, date_param DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    avg_time DECIMAL(10,2);
BEGIN
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (ready_at - created_at)) / 60), 0)
    INTO avg_time
    FROM pharmacy_orders
    WHERE pharmacy_id = pharmacy_id_param
        AND DATE(created_at) = date_param
        AND ready_at IS NOT NULL
        AND status IN ('ready', 'delivered');
    
    RETURN ROUND(avg_time, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE pharmacy_orders IS 'Commandes de médicaments dans les pharmacies';
COMMENT ON TABLE pharmacy_order_items IS 'Détails des médicaments dans chaque commande';
COMMENT ON TABLE pharmacy_reservations IS 'Réservations de médicaments en attente de disponibilité';
COMMENT ON TABLE pharmacy_analytics IS 'Statistiques quotidiennes des pharmacies pour analytics';






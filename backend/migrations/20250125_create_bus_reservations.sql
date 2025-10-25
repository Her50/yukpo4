-- Migration: Create bus_reservations table
-- Description: Gestion des réservations de places de bus pour les tickets de voyage

CREATE TABLE IF NOT EXISTS bus_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seat_id VARCHAR(50) NOT NULL, -- Format: "row-col" (ex: "1-2")
    seat_number INTEGER NOT NULL, -- Numéro de la place
    status VARCHAR(20) NOT NULL DEFAULT 'reserved', -- reserved, confirmed, cancelled
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_product_seat UNIQUE (product_id, seat_id)
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_bus_reservations_user ON bus_reservations(user_id);
CREATE INDEX idx_bus_reservations_product ON bus_reservations(product_id);
CREATE INDEX idx_bus_reservations_status ON bus_reservations(status);
CREATE INDEX idx_bus_reservations_created_at ON bus_reservations(created_at DESC);

-- Ajouter les colonnes nécessaires dans la table products si elles n'existent pas
DO $$ 
BEGIN
    -- Colonne pour stocker la configuration du bus
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='bus_configuration') THEN
        ALTER TABLE products ADD COLUMN bus_configuration JSONB;
    END IF;

    -- Colonne pour stocker le plan des sièges
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='seat_map') THEN
        ALTER TABLE products ADD COLUMN seat_map JSONB;
    END IF;

    -- Colonne pour le nombre total de places
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='total_seats') THEN
        ALTER TABLE products ADD COLUMN total_seats INTEGER;
    END IF;
END $$;

-- Commentaires
COMMENT ON TABLE bus_reservations IS 'Table des réservations de places de bus pour les tickets de voyage';
COMMENT ON COLUMN bus_reservations.seat_id IS 'Identifiant de la place au format row-col';
COMMENT ON COLUMN bus_reservations.seat_number IS 'Numéro de la place affiché aux utilisateurs';
COMMENT ON COLUMN bus_reservations.status IS 'Statut de la réservation: reserved, confirmed, cancelled';


-- Migration: Système de réservation de places de bus
-- Date: 2025-01-25
-- Description: Gestion des réservations de places de bus pour les tickets de voyage (ticket_voyage)
-- Note: Compatible avec SQLx offline mode

-- 1. Créer la table des réservations de bus
CREATE TABLE IF NOT EXISTS bus_reservations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    product_id TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seat_id VARCHAR(50) NOT NULL,
    seat_number INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_product_seat UNIQUE (product_id, seat_id)
);

-- 2. Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_bus_reservations_user ON bus_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_bus_reservations_product ON bus_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_bus_reservations_status ON bus_reservations(status);
CREATE INDEX IF NOT EXISTS idx_bus_reservations_created_at ON bus_reservations(created_at DESC);

-- Index composite pour requêtes courantes
CREATE INDEX IF NOT EXISTS idx_bus_reservations_product_status 
ON bus_reservations(product_id, status) WHERE status = 'reserved';

-- 3. Ajouter les colonnes nécessaires dans la table products si elles n'existent pas
DO $$ 
BEGIN
    -- Colonne pour stocker la configuration du bus
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='bus_configuration') THEN
        ALTER TABLE products ADD COLUMN bus_configuration JSONB;
        RAISE NOTICE 'Colonne bus_configuration ajoutée à products';
    END IF;

    -- Colonne pour stocker le plan des sièges
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='seat_map') THEN
        ALTER TABLE products ADD COLUMN seat_map JSONB;
        RAISE NOTICE 'Colonne seat_map ajoutée à products';
    END IF;

    -- Colonne pour le nombre total de places
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='total_seats') THEN
        ALTER TABLE products ADD COLUMN total_seats INTEGER;
        RAISE NOTICE 'Colonne total_seats ajoutée à products';
    END IF;
END $$;

-- 4. Index sur les nouvelles colonnes de products
CREATE INDEX IF NOT EXISTS idx_products_total_seats ON products(total_seats) WHERE total_seats IS NOT NULL;

-- 5. Fonction pour valider le format du seat_id
CREATE OR REPLACE FUNCTION validate_seat_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Vérifier que seat_id est au format "row-col"
    IF NEW.seat_id !~ '^\d+-\d+$' THEN
        RAISE EXCEPTION 'Format seat_id invalide: % (attendu: row-col)', NEW.seat_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour valider seat_id avant insertion
DROP TRIGGER IF EXISTS trigger_validate_seat_id ON bus_reservations;
CREATE TRIGGER trigger_validate_seat_id
    BEFORE INSERT OR UPDATE ON bus_reservations
    FOR EACH ROW
    EXECUTE FUNCTION validate_seat_id();

-- 6. Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_bus_reservation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement updated_at
DROP TRIGGER IF EXISTS trigger_update_bus_reservation_timestamp ON bus_reservations;
CREATE TRIGGER trigger_update_bus_reservation_timestamp
    BEFORE UPDATE ON bus_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_bus_reservation_timestamp();

-- 7. Vue pour les réservations actives avec informations du produit
CREATE OR REPLACE VIEW active_bus_reservations AS
SELECT 
    br.id,
    br.product_id,
    br.user_id,
    br.seat_id,
    br.seat_number,
    br.status,
    br.created_at,
    br.updated_at,
    u.name as user_name,
    u.email as user_email,
    p.name as product_name,
    p.type as product_type
FROM bus_reservations br
JOIN users u ON u.id = br.user_id
LEFT JOIN products p ON p.id::text = br.product_id
WHERE br.status = 'reserved';

-- 8. Commentaires pour la documentation
COMMENT ON TABLE bus_reservations IS 'Réservations de places de bus pour les tickets de voyage (ticket_voyage)';
COMMENT ON COLUMN bus_reservations.id IS 'Identifiant unique de la réservation (UUID au format text)';
COMMENT ON COLUMN bus_reservations.product_id IS 'Identifiant du produit (ticket de voyage) au format text';
COMMENT ON COLUMN bus_reservations.seat_id IS 'Identifiant de la place au format row-col (ex: 1-2, 3-4)';
COMMENT ON COLUMN bus_reservations.seat_number IS 'Numéro de la place affiché aux utilisateurs (1, 2, 3...)';
COMMENT ON COLUMN bus_reservations.status IS 'Statut: reserved (réservée), confirmed (confirmée), cancelled (annulée)';

COMMENT ON COLUMN products.bus_configuration IS 'Configuration du bus: {rows, seatsPerRow, firstRowSeats, allSeatsAvailable}';
COMMENT ON COLUMN products.seat_map IS 'Plan complet des sièges avec statuts et types (array JSONB)';
COMMENT ON COLUMN products.total_seats IS 'Nombre total de places passagers (excluant le chauffeur)';

-- 9. Statistiques initiales
SELECT 
    COUNT(*) as total_reservations,
    COUNT(CASE WHEN status = 'reserved' THEN 1 END) as reserved,
    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
FROM bus_reservations;


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
    passenger_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')),
    caution_amount INTEGER DEFAULT 500,
    total_price INTEGER,
    payment_status VARCHAR(20) DEFAULT 'caution_paid' CHECK (payment_status IN ('caution_paid', 'fully_paid', 'refunded')),
    ticket_pdf_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 minutes'),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_product_seat UNIQUE (product_id, seat_id)
);

-- 2. Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_bus_reservations_user ON bus_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_bus_reservations_product ON bus_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_bus_reservations_status ON bus_reservations(status);
CREATE INDEX IF NOT EXISTS idx_bus_reservations_created_at ON bus_reservations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bus_reservations_expires_at ON bus_reservations(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bus_reservations_payment_status ON bus_reservations(payment_status);

-- Index composite pour requêtes courantes
CREATE INDEX IF NOT EXISTS idx_bus_reservations_product_status 
ON bus_reservations(product_id, status) WHERE status IN ('pending', 'confirmed');

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

    -- Colonnes pour informations ticket PDF
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='numero_bus') THEN
        ALTER TABLE products ADD COLUMN numero_bus VARCHAR(50);
        RAISE NOTICE 'Colonne numero_bus ajoutée à products';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='logo_agence') THEN
        ALTER TABLE products ADD COLUMN logo_agence TEXT;
        RAISE NOTICE 'Colonne logo_agence ajoutée à products';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='conditions_voyage') THEN
        ALTER TABLE products ADD COLUMN conditions_voyage TEXT;
        RAISE NOTICE 'Colonne conditions_voyage ajoutée à products';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='caution_reservation') THEN
        ALTER TABLE products ADD COLUMN caution_reservation INTEGER DEFAULT 500;
        RAISE NOTICE 'Colonne caution_reservation ajoutée à products';
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

-- 9. Fonction pour expirer automatiquement les réservations non confirmées
CREATE OR REPLACE FUNCTION expire_unconfirmed_reservations()
RETURNS TABLE(
    reservation_id TEXT,
    product_id TEXT,
    seat_id VARCHAR(50),
    user_id INTEGER
) AS $$
BEGIN
    -- Marquer comme expirées et libérer les places
    RETURN QUERY
    UPDATE bus_reservations
    SET 
        status = 'expired',
        payment_status = 'refunded',
        updated_at = NOW()
    WHERE status = 'pending'
        AND expires_at <= NOW()
    RETURNING 
        id as reservation_id,
        bus_reservations.product_id,
        bus_reservations.seat_id,
        bus_reservations.user_id;
END;
$$ LANGUAGE plpgsql;

-- 10. Fonction pour confirmer une réservation après paiement complet
CREATE OR REPLACE FUNCTION confirm_bus_reservation(
    p_reservation_id TEXT,
    p_total_price INTEGER,
    p_ticket_pdf_url TEXT
) RETURNS JSONB AS $$
DECLARE
    v_reservation RECORD;
    v_user_balance BIGINT;
    v_remaining_amount INTEGER;
BEGIN
    -- Récupérer la réservation
    SELECT * INTO v_reservation
    FROM bus_reservations
    WHERE id = p_reservation_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Réservation non trouvée ou déjà traitée'
        );
    END IF;
    
    -- Vérifier si pas expirée
    IF v_reservation.expires_at < NOW() THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Réservation expirée'
        );
    END IF;
    
    -- Calculer le montant restant à payer
    v_remaining_amount := p_total_price - v_reservation.caution_amount;
    
    -- Vérifier le solde de l'utilisateur
    SELECT tokens_balance INTO v_user_balance
    FROM users
    WHERE id = v_reservation.user_id;
    
    IF v_user_balance < v_remaining_amount THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Solde insuffisant',
            'required', v_remaining_amount,
            'balance', v_user_balance
        );
    END IF;
    
    -- Débiter le solde
    UPDATE users
    SET tokens_balance = tokens_balance - v_remaining_amount
    WHERE id = v_reservation.user_id;
    
    -- Confirmer la réservation
    UPDATE bus_reservations
    SET 
        status = 'confirmed',
        payment_status = 'fully_paid',
        total_price = p_total_price,
        ticket_pdf_url = p_ticket_pdf_url,
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Réservation confirmée avec succès',
        'total_paid', p_total_price,
        'caution', v_reservation.caution_amount,
        'remaining_paid', v_remaining_amount,
        'new_balance', v_user_balance - v_remaining_amount,
        'ticket_url', p_ticket_pdf_url
    );
END;
$$ LANGUAGE plpgsql;

-- 11. Commentaires sur les nouvelles colonnes
COMMENT ON COLUMN bus_reservations.passenger_name IS 'Nom du passager (pour le ticket PDF)';
COMMENT ON COLUMN bus_reservations.caution_amount IS 'Montant de la caution payée pour bloquer la place (FCFA)';
COMMENT ON COLUMN bus_reservations.total_price IS 'Prix total du ticket (FCFA)';
COMMENT ON COLUMN bus_reservations.payment_status IS 'caution_paid: caution seulement, fully_paid: ticket payé, refunded: remboursé';
COMMENT ON COLUMN bus_reservations.ticket_pdf_url IS 'URL du ticket PDF généré après confirmation';
COMMENT ON COLUMN bus_reservations.expires_at IS 'Date d''expiration de la réservation (30 min par défaut)';

-- 12. Statistiques initiales
SELECT 
    COUNT(*) as total_reservations,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
    COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired
FROM bus_reservations;


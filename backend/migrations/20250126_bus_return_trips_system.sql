-- Migration: Système complet aller-retour pour tickets de bus
-- Date: 2025-01-26
-- Description: Gestion des trajets retour, notifications, et paiements de tickets

-- 1. Table pour les paiements de tickets de bus (tracabilité complète)
CREATE TABLE IF NOT EXISTS bus_ticket_payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agency_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Propriétaire agence
    product_id TEXT NOT NULL, -- Le ticket de voyage
    reservation_ids TEXT[] NOT NULL, -- IDs des réservations de ce paiement
    
    -- Montants détaillés
    ticket_price INTEGER NOT NULL, -- Prix unitaire du ticket
    number_of_tickets INTEGER NOT NULL DEFAULT 1, -- Nombre de tickets
    subtotal INTEGER NOT NULL, -- ticket_price × number_of_tickets
    booking_fee INTEGER NOT NULL DEFAULT 500, -- Frais de réservation (500 FCFA fixe)
    total_amount INTEGER NOT NULL, -- subtotal + booking_fee
    currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
    
    -- Informations voyage
    bus_number VARCHAR(50),
    departure_city TEXT NOT NULL,
    arrival_city TEXT NOT NULL,
    departure_date VARCHAR(20) NOT NULL,
    departure_time VARCHAR(10) NOT NULL,
    company_name TEXT,
    
    -- Statut paiement
    payment_status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('completed', 'refunded', 'partial_refund')),
    payment_method JSONB,
    
    -- Tracabilité
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_amount INTEGER DEFAULT 0,
    refund_reason TEXT,
    
    CONSTRAINT positive_amounts CHECK (ticket_price > 0 AND subtotal > 0 AND total_amount > 0)
);

-- 2. Table pour les demandes de retour
CREATE TABLE IF NOT EXISTS return_trip_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outbound_ticket_id TEXT NOT NULL, -- ID du ticket aller
    outbound_payment_id TEXT REFERENCES bus_ticket_payments(id),
    
    -- Informations trajet retour souhaité
    return_from TEXT NOT NULL, -- Destination du voyage aller
    return_to TEXT NOT NULL, -- Départ du voyage aller (inverse)
    preferred_return_date VARCHAR(20) NOT NULL, -- DD/MM/YYYY
    preferred_return_time VARCHAR(10), -- HH:MM (optionnel, flexible)
    date_flexibility_days INTEGER DEFAULT 1, -- ±1 jour acceptable
    
    -- Passagers et places
    passenger_names TEXT[] NOT NULL, -- Noms des passagers
    number_of_seats INTEGER NOT NULL,
    
    -- Informations paiement
    already_paid BOOLEAN DEFAULT TRUE, -- Payé avec le ticket aller
    paid_amount INTEGER, -- Montant déjà payé pour le retour
    
    -- Matching avec bus retour
    matched_product_id TEXT, -- ID du bus retour trouvé
    matched_at TIMESTAMP WITH TIME ZONE,
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Réservation effectuée
    reservation_completed BOOLEAN DEFAULT FALSE,
    reservation_ids TEXT[], -- IDs des réservations confirmées
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Statut
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'completed', 'cancelled', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days'), -- Expire après 3 mois
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table pour les places pré-réservées (retour)
CREATE TABLE IF NOT EXISTS prebooked_return_seats (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    return_request_id TEXT NOT NULL REFERENCES return_trip_requests(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL, -- Bus retour
    seat_ids TEXT[] NOT NULL, -- Places pré-réservées
    passenger_names TEXT[] NOT NULL,
    
    status VARCHAR(20) DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'released')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE
);

-- 4. Index pour performances
CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_user ON bus_ticket_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_agency ON bus_ticket_payments(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_date ON bus_ticket_payments(departure_date, departure_time);
CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_route ON bus_ticket_payments(departure_city, arrival_city);
CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_created ON bus_ticket_payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_return_requests_user ON return_trip_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_trip_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_route ON return_trip_requests(return_from, return_to);
CREATE INDEX IF NOT EXISTS idx_return_requests_date ON return_trip_requests(preferred_return_date);
CREATE INDEX IF NOT EXISTS idx_return_requests_pending ON return_trip_requests(status, preferred_return_date) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_prebooked_seats_product ON prebooked_return_seats(product_id);
CREATE INDEX IF NOT EXISTS idx_prebooked_seats_request ON prebooked_return_seats(return_request_id);

-- 5. Fonction pour matcher automatiquement les demandes de retour
CREATE OR REPLACE FUNCTION match_return_trip_requests(p_product_id TEXT)
RETURNS TABLE(
    request_id TEXT,
    user_id INTEGER,
    passenger_names TEXT[],
    number_of_seats INTEGER
) AS $$
BEGIN
    -- Trouver les demandes de retour correspondantes
    -- Quand un nouveau bus est créé, on check s'il match des demandes
    RETURN QUERY
    SELECT 
        rtr.id as request_id,
        rtr.user_id,
        rtr.passenger_names,
        rtr.number_of_seats
    FROM return_trip_requests rtr
    JOIN products p ON p.id::text = p_product_id
    WHERE rtr.status = 'pending'
        -- Match route (inverse du voyage)
        AND rtr.return_from = p.depart
        AND rtr.return_to = p.destination
        -- Match date (avec flexibilité)
        AND p.date_depart BETWEEN 
            (rtr.preferred_return_date::date - INTERVAL '1 day' * rtr.date_flexibility_days)
            AND (rtr.preferred_return_date::date + INTERVAL '1 day' * rtr.date_flexibility_days)
        -- Vérifier qu'il y a assez de places
        AND p.total_seats >= rtr.number_of_seats;
END;
$$ LANGUAGE plpgsql;

-- 6. Fonction pour pré-réserver les places du retour
CREATE OR REPLACE FUNCTION prebook_return_seats(
    p_request_id TEXT,
    p_product_id TEXT,
    p_seat_ids TEXT[],
    p_passenger_names TEXT[]
) RETURNS JSONB AS $$
DECLARE
    v_request RECORD;
BEGIN
    -- Vérifier que la demande existe
    SELECT * INTO v_request
    FROM return_trip_requests
    WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Demande de retour non trouvée'
        );
    END IF;
    
    -- Créer la pré-réservation
    INSERT INTO prebooked_return_seats (
        return_request_id,
        product_id,
        seat_ids,
        passenger_names,
        status
    ) VALUES (
        p_request_id,
        p_product_id,
        p_seat_ids,
        p_passenger_names,
        'reserved'
    );
    
    -- Marquer comme matched
    UPDATE return_trip_requests
    SET 
        matched_product_id = p_product_id,
        matched_at = NOW(),
        status = 'matched'
    WHERE id = p_request_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Places pré-réservées avec succès'
    );
END;
$$ LANGUAGE plpgsql;

-- 7. Fonction pour calculer frais de réservation selon devise
CREATE OR REPLACE FUNCTION calculate_booking_fee(p_currency VARCHAR(10))
RETURNS INTEGER AS $$
BEGIN
    -- 500 FCFA de base
    CASE p_currency
        WHEN 'XAF' THEN RETURN 500;
        WHEN 'EUR' THEN RETURN 1; -- ~1€
        WHEN 'USD' THEN RETURN 1; -- ~1$
        WHEN 'XOF' THEN RETURN 500; -- Même zone
        ELSE RETURN 500; -- Par défaut
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- 8. Vue pour les statistiques des paiements par agence
CREATE OR REPLACE VIEW bus_payment_stats_by_agency AS
SELECT 
    btp.agency_user_id,
    u.name as agency_name,
    COUNT(*) as total_payments,
    SUM(btp.number_of_tickets) as total_tickets_sold,
    SUM(btp.subtotal) as total_ticket_revenue,
    SUM(btp.booking_fee) as total_booking_fees,
    SUM(btp.total_amount) as total_revenue,
    DATE_TRUNC('month', btp.created_at) as month
FROM bus_ticket_payments btp
JOIN users u ON u.id = btp.agency_user_id
WHERE btp.payment_status = 'completed'
GROUP BY btp.agency_user_id, u.name, DATE_TRUNC('month', btp.created_at)
ORDER BY month DESC, total_revenue DESC;

-- 9. Commentaires
COMMENT ON TABLE bus_ticket_payments IS 'Paiements de tickets de bus avec tracabilité complète (user, agence, voyage, montants séparés)';
COMMENT ON COLUMN bus_ticket_payments.booking_fee IS 'Frais de réservation en ligne fixe de 500 FCFA (par réservation, pas par ticket)';
COMMENT ON COLUMN bus_ticket_payments.subtotal IS 'Montant tickets uniquement (ticket_price × number_of_tickets)';
COMMENT ON COLUMN bus_ticket_payments.total_amount IS 'Montant total (subtotal + booking_fee)';

COMMENT ON TABLE return_trip_requests IS 'Demandes de trajet retour avec matching automatique quand bus créé';
COMMENT ON COLUMN return_trip_requests.already_paid IS 'TRUE si payé avec aller, FALSE si à payer séparément';
COMMENT ON COLUMN return_trip_requests.date_flexibility_days IS 'Flexibilité en jours (±X jours acceptable)';

COMMENT ON TABLE prebooked_return_seats IS 'Places pré-réservées pour trajets retour (déjà payées)';

-- 10. Statistiques initiales
SELECT 
    COUNT(*) as total_payments,
    SUM(number_of_tickets) as total_tickets,
    SUM(subtotal) as revenue_tickets,
    SUM(booking_fee) as revenue_fees,
    SUM(total_amount) as revenue_total
FROM bus_ticket_payments;


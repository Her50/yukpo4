-- Tables pour le système de tickets de bus

-- ============================================================================
-- TABLE PRODUCTS (UUID) - Tickets de bus structurés 🎫
-- ============================================================================
-- Table physique pour les produits structurés (ex: tickets de bus) distincts de services.data->produits
-- Cette table est utilisée par les fonctions bus pour les réservations et paiements

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    price_cents BIGINT,
    currency VARCHAR(10) DEFAULT 'XAF',
    seat_map JSONB,
    bus_configuration JSONB,
    total_seats INTEGER,
    numero_bus VARCHAR(50),
    logo_agence TEXT,
    conditions_voyage TEXT,
    caution_reservation INTEGER DEFAULT 500,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_service_id ON products(service_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

COMMENT ON TABLE products IS 'Table physique pour les produits structurés (ex: tickets de bus) distincts de services.data->produits';
COMMENT ON COLUMN products.id IS 'Identifiant unique du produit (UUID)';
COMMENT ON COLUMN products.service_id IS 'Service propriétaire du produit';
COMMENT ON COLUMN products.type IS 'Type fonctionnel du produit (ex: ticket_voyage, abonnement, etc.)';
COMMENT ON COLUMN products.seat_map IS 'Plan de sièges JSONB pour les produits de type transport';
COMMENT ON COLUMN products.bus_configuration IS 'Configuration détaillée du bus (rows, seats_per_row, etc.)';

-- ============================================================================
-- SYSTÈME COMMISSION ET REVERSEMENT TICKETS BUS 💰
-- ============================================================================

-- Table pour les paiements de tickets de bus (doit être créée avant les ALTER TABLE)
CREATE TABLE IF NOT EXISTS bus_ticket_payments (
    id TEXT PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS TEXT),
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_amount INTEGER DEFAULT 0,
    refund_reason TEXT,
    
    CONSTRAINT positive_amounts CHECK (ticket_price > 0 AND subtotal > 0 AND total_amount > 0)
);

-- Index pour bus_ticket_payments
CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_user ON bus_ticket_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_agency ON bus_ticket_payments(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_date ON bus_ticket_payments(departure_date, departure_time);
CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_route ON bus_ticket_payments(departure_city, arrival_city);
CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_created ON bus_ticket_payments(created_at DESC);

-- Ajouter colonnes commission et reversement à bus_ticket_payments
DO $$ 
BEGIN
    -- Commission Yukpo (5% du montant ticket)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='yukpo_commission') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN yukpo_commission INTEGER;
    END IF;
    
    -- Montant reversé à l'agence (subtotal - commission)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='agency_payout') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN agency_payout INTEGER;
    END IF;
    
    -- Statut reversement
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='payout_status') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN payout_status VARCHAR(20) DEFAULT 'pending';
    END IF;
    
    -- Date reversement
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='payout_at') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN payout_at TIMESTAMPTZ;
    END IF;
    
    -- URL ticket PDF généré
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='ticket_pdf_url') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN ticket_pdf_url TEXT;
    END IF;
END $$;

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_bus_payments_payout_status ON bus_ticket_payments(payout_status) WHERE payout_status = 'pending';

-- Fonction pour calculer commission et reverser automatiquement
CREATE OR REPLACE FUNCTION process_bus_ticket_payment_with_commission(
    p_payment_id TEXT,
    p_ticket_price INTEGER,
    p_number_of_tickets INTEGER,
    p_booking_fee INTEGER DEFAULT 500
)
RETURNS JSONB AS $$
DECLARE
    v_subtotal INTEGER;
    v_commission INTEGER;
    v_agency_payout INTEGER;
    v_total_amount INTEGER;
    v_payment RECORD;
    v_agency_user_id INTEGER;
BEGIN
    -- Calculer montants
    v_subtotal := p_ticket_price * p_number_of_tickets;
    v_commission := ROUND(v_subtotal * 0.05); -- 5% commission
    v_agency_payout := v_subtotal - v_commission;
    v_total_amount := v_subtotal + p_booking_fee;
    
    -- Récupérer le payment pour obtenir agency_user_id
    SELECT agency_user_id INTO v_agency_user_id
    FROM bus_ticket_payments
    WHERE id = p_payment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé');
    END IF;
    
    -- Mettre à jour le paiement
    UPDATE bus_ticket_payments
    SET 
        subtotal = v_subtotal,
        yukpo_commission = v_commission,
        agency_payout = v_agency_payout,
        total_amount = v_total_amount,
        booking_fee = p_booking_fee,
        payout_status = 'pending',
        updated_at = NOW()
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;
    
    -- Reverser automatiquement à l'agence
    UPDATE users
    SET tokens_balance = tokens_balance + v_agency_payout
    WHERE id = v_agency_user_id;
    
    -- Marquer reversement comme complété
    UPDATE bus_ticket_payments
    SET 
        payout_status = 'completed',
        payout_at = NOW()
    WHERE id = p_payment_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', p_payment_id,
        'subtotal', v_subtotal,
        'yukpo_commission', v_commission,
        'agency_payout', v_agency_payout,
        'total_amount', v_total_amount,
        'payout_status', 'completed'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_bus_ticket_payment_with_commission IS 'Calcule la commission Yukpo (5%) et reverse automatiquement le montant à l''agence';

-- ============================================================================
-- TABLE BUS_RESERVATIONS (doit être créée avant bus_boarding_status)
-- ============================================================================

-- Table pour les réservations de places de bus
CREATE TABLE IF NOT EXISTS bus_reservations (
    id TEXT PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS TEXT),
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

-- Index pour bus_reservations
CREATE INDEX IF NOT EXISTS idx_bus_reservations_user ON bus_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_bus_reservations_product ON bus_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_bus_reservations_status ON bus_reservations(status);
CREATE INDEX IF NOT EXISTS idx_bus_reservations_created_at ON bus_reservations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bus_reservations_expires_at ON bus_reservations(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bus_reservations_payment_status ON bus_reservations(payment_status);
CREATE INDEX IF NOT EXISTS idx_bus_reservations_product_status ON bus_reservations(product_id, status) WHERE status IN ('pending', 'confirmed');

-- ============================================================================
-- SYSTÈME VALIDATION TICKETS BUS AVEC QR CODE ✅
-- ============================================================================

-- Table pour le statut d'embarquement des passagers
CREATE TABLE IF NOT EXISTS bus_boarding_status (
    id TEXT PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS TEXT),
    reservation_id TEXT NOT NULL REFERENCES bus_reservations(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    payment_id TEXT REFERENCES bus_ticket_payments(id) ON DELETE SET NULL,
    boarding_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (boarding_status IN ('pending', 'boarded', 'no_show', 'cancelled')),
    is_validated BOOLEAN NOT NULL DEFAULT FALSE,
    validated_at TIMESTAMPTZ,
    validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    validation_method VARCHAR(20) CHECK (validation_method IN ('qr_code', 'manual', 'api')),
    qr_code_data JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_reservation_boarding UNIQUE (reservation_id)
);

CREATE INDEX IF NOT EXISTS idx_bus_boarding_product ON bus_boarding_status(product_id);
CREATE INDEX IF NOT EXISTS idx_bus_boarding_reservation ON bus_boarding_status(reservation_id);
CREATE INDEX IF NOT EXISTS idx_bus_boarding_status ON bus_boarding_status(boarding_status);
CREATE INDEX IF NOT EXISTS idx_bus_boarding_validated ON bus_boarding_status(is_validated) WHERE is_validated = TRUE;
CREATE INDEX IF NOT EXISTS idx_bus_boarding_validated_by ON bus_boarding_status(validated_by);

-- Fonction pour valider un ticket via QR code
CREATE OR REPLACE FUNCTION validate_bus_ticket(
    p_qr_code_data JSONB,
    p_validator_user_id INTEGER,
    p_product_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_reservation_id TEXT;
    v_payment_id TEXT;
    v_product_id TEXT;
    v_reservation RECORD;
    v_payment RECORD;
    v_boarding_status RECORD;
    v_count INTEGER;
BEGIN
    v_reservation_id := p_qr_code_data->>'id';
    v_payment_id := p_qr_code_data->>'payment_id';
    v_product_id := COALESCE(p_product_id, p_qr_code_data->>'product_id');
    
    IF v_reservation_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'ID réservation manquant dans QR code');
    END IF;
    
    SELECT * INTO v_reservation FROM bus_reservations
    WHERE id = v_reservation_id AND status = 'confirmed';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Réservation non trouvée ou non confirmée');
    END IF;
    
    IF v_product_id IS NOT NULL AND v_reservation.product_id != v_product_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Ticket ne correspond pas à ce bus');
    END IF;
    
    IF v_payment_id IS NOT NULL THEN
        SELECT * INTO v_payment FROM bus_ticket_payments
        WHERE id = v_payment_id AND payment_status = 'completed';
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé ou non complété');
        END IF;
    END IF;
    
    -- ⚠️ SÉCURITÉ ANTI-DOUBLE UTILISATION : Vérifier si le ticket est déjà validé
    SELECT * INTO v_boarding_status FROM bus_boarding_status 
    WHERE reservation_id = v_reservation_id;
    
    IF FOUND AND v_boarding_status.is_validated = TRUE THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Ticket déjà utilisé - Ce ticket a déjà été validé et ne peut plus être utilisé',
            'already_boarded', TRUE,
            'boarded_at', v_boarding_status.validated_at,
            'validated_by_user_id', v_boarding_status.validated_by,
            'validation_method', v_boarding_status.validation_method
        );
    END IF;
    
    -- Vérification supplémentaire par payment_id
    IF v_payment_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM bus_boarding_status 
        WHERE payment_id = v_payment_id AND is_validated = TRUE;
        
        IF v_count > 0 THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'Ticket déjà utilisé - Ce paiement a déjà été validé pour un autre passager',
                'already_boarded', TRUE
            );
        END IF;
    END IF;
    
    -- Créer ou mettre à jour boarding_status
    IF FOUND THEN
        UPDATE bus_boarding_status
        SET boarding_status = 'boarded', is_validated = TRUE, validated_at = NOW(),
            validated_by = p_validator_user_id, validation_method = 'qr_code',
            qr_code_data = p_qr_code_data, updated_at = NOW()
        WHERE reservation_id = v_reservation_id AND is_validated = FALSE
        RETURNING * INTO v_boarding_status;
        
        IF NOT FOUND THEN
            SELECT * INTO v_boarding_status FROM bus_boarding_status 
            WHERE reservation_id = v_reservation_id;
            
            IF v_boarding_status.is_validated = TRUE THEN
                RETURN jsonb_build_object(
                    'success', FALSE,
                    'error', 'Ticket déjà utilisé',
                    'already_boarded', TRUE,
                    'boarded_at', v_boarding_status.validated_at
                );
            END IF;
        END IF;
    ELSE
        BEGIN
            INSERT INTO bus_boarding_status (
                reservation_id, product_id, payment_id, boarding_status, is_validated,
                validated_at, validated_by, validation_method, qr_code_data
            ) VALUES (
                v_reservation_id, v_reservation.product_id, v_payment_id, 'boarded', TRUE,
                NOW(), p_validator_user_id, 'qr_code', p_qr_code_data
            ) RETURNING * INTO v_boarding_status;
        EXCEPTION
            WHEN unique_violation THEN
                SELECT * INTO v_boarding_status FROM bus_boarding_status 
                WHERE reservation_id = v_reservation_id;
                
                IF v_boarding_status.is_validated = TRUE THEN
                    RETURN jsonb_build_object(
                        'success', FALSE,
                        'error', 'Ticket déjà utilisé',
                        'already_boarded', TRUE,
                        'boarded_at', v_boarding_status.validated_at
                    );
                END IF;
        END;
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'reservation_id', v_reservation_id,
        'passenger_name', v_reservation.passenger_name,
        'seat_id', v_reservation.seat_id,
        'seat_number', v_reservation.seat_number,
        'validated_at', v_boarding_status.validated_at,
        'message', 'Ticket validé avec succès'
    );
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir le résumé d'embarquement
CREATE OR REPLACE FUNCTION get_bus_boarding_summary(p_product_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_total_reservations INTEGER := 0;
    v_boarded_passengers INTEGER := 0;
    v_pending_passengers INTEGER := 0;
    v_no_show_passengers INTEGER := 0;
BEGIN
    SELECT COUNT(*) INTO v_total_reservations FROM bus_reservations
    WHERE product_id = p_product_id AND status = 'confirmed';
    
    SELECT COUNT(*) INTO v_boarded_passengers FROM bus_boarding_status
    WHERE product_id = p_product_id AND boarding_status = 'boarded' AND is_validated = TRUE;
    
    SELECT COUNT(*) INTO v_pending_passengers FROM bus_reservations br
    WHERE br.product_id = p_product_id AND br.status = 'confirmed'
        AND NOT EXISTS (
            SELECT 1 FROM bus_boarding_status bbs
            WHERE bbs.reservation_id = br.id AND bbs.is_validated = TRUE
        );
    
    SELECT COUNT(*) INTO v_no_show_passengers FROM bus_reservations br
    JOIN products p ON CAST(p.id AS TEXT) = br.product_id
    WHERE br.product_id = p_product_id AND br.status = 'confirmed'
        AND CAST((p.metadata->>'departure_date' || ' ' || p.metadata->>'departure_time') AS TIMESTAMP) + INTERVAL '15 minutes' < NOW()
        AND NOT EXISTS (
            SELECT 1 FROM bus_boarding_status bbs
            WHERE bbs.reservation_id = br.id AND bbs.is_validated = TRUE
        );
    
    RETURN jsonb_build_object(
        'total_reservations', v_total_reservations,
        'boarded_passengers', v_boarded_passengers,
        'pending_passengers', v_pending_passengers,
        'no_show_passengers', v_no_show_passengers,
        'completion_percentage', CASE 
            WHEN v_total_reservations > 0 THEN 
                ROUND((CAST(v_boarded_passengers AS FLOAT) / CAST(v_total_reservations AS FLOAT)) * 100, 2)
            ELSE 0
        END,
        'is_complete', (v_boarded_passengers = v_total_reservations AND v_total_reservations > 0)
    );
END;
$$ LANGUAGE plpgsql;

-- Vue pour liste des passagers avec statut embarquement
CREATE OR REPLACE VIEW bus_passengers_with_boarding AS
SELECT 
    br.id as reservation_id, br.product_id, br.user_id, br.seat_id, br.seat_number,
    br.passenger_name, br.status as reservation_status,
    btp.id as payment_id, btp.total_amount,
    bbs.id as boarding_status_id, bbs.boarding_status, bbs.is_validated,
    bbs.validated_at, bbs.validated_by, bbs.validation_method,
    u.nom_complet as validator_name,
    CASE 
        WHEN bbs.is_validated = TRUE THEN 'boarded'
        WHEN bbs.boarding_status = 'no_show' THEN 'no_show'
        WHEN bbs.boarding_status = 'cancelled' THEN 'cancelled'
        ELSE 'pending'
    END as display_status
FROM bus_reservations br
LEFT JOIN bus_ticket_payments btp ON btp.id = ANY(
    SELECT unnest(btp2.reservation_ids) FROM bus_ticket_payments btp2 
    WHERE br.id = ANY(btp2.reservation_ids) LIMIT 1
)
LEFT JOIN bus_boarding_status bbs ON bbs.reservation_id = br.id
LEFT JOIN users u ON u.id = bbs.validated_by
WHERE br.status = 'confirmed';

-- ============================================================================
-- GESTION MANUELLE PLACES NON DISPONIBLES 🔒
-- ============================================================================

-- Table pour les blocages manuels de places
CREATE TABLE IF NOT EXISTS bus_seat_blocks (
    id TEXT PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS TEXT),
    product_id TEXT NOT NULL,
    seat_id VARCHAR(50) NOT NULL,
    seat_number INTEGER NOT NULL,
    reason VARCHAR(100) NOT NULL DEFAULT 'maintenance' CHECK (reason IN ('maintenance', 'damaged', 'reserved', 'other')),
    reason_details TEXT,
    blocked_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    unblocked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    unblocked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bus_seat_blocks_product ON bus_seat_blocks(product_id);
CREATE INDEX IF NOT EXISTS idx_bus_seat_blocks_active ON bus_seat_blocks(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_bus_seat_blocks_seat ON bus_seat_blocks(seat_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bus_seat_blocks_unique_active ON bus_seat_blocks(product_id, seat_id) WHERE is_active = TRUE;

-- Fonction pour bloquer une place manuellement
CREATE OR REPLACE FUNCTION block_bus_seat_manually(
    p_product_id TEXT,
    p_seat_id VARCHAR(50),
    p_seat_number INTEGER,
    p_blocked_by INTEGER,
    p_reason VARCHAR(100) DEFAULT 'maintenance',
    p_reason_details TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_block_id TEXT;
    v_existing_block RECORD;
BEGIN
    SELECT * INTO v_existing_block FROM bus_seat_blocks
    WHERE product_id = p_product_id AND seat_id = p_seat_id AND is_active = TRUE;
    
    IF FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Place déjà bloquée');
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM bus_reservations
        WHERE product_id = p_product_id AND seat_id = p_seat_id AND status IN ('pending', 'confirmed')
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Place déjà réservée, impossible de bloquer');
    END IF;
    
    INSERT INTO bus_seat_blocks (product_id, seat_id, seat_number, blocked_by, reason, reason_details)
    VALUES (p_product_id, p_seat_id, p_seat_number, p_blocked_by, p_reason, p_reason_details)
    RETURNING id INTO v_block_id;
    
    RETURN jsonb_build_object('success', TRUE, 'block_id', v_block_id, 'message', 'Place bloquée avec succès');
END;
$$ LANGUAGE plpgsql;

-- Fonction pour débloquer une place
CREATE OR REPLACE FUNCTION unblock_bus_seat_manually(
    p_product_id TEXT,
    p_seat_id VARCHAR(50),
    p_unblocked_by INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_block RECORD;
BEGIN
    SELECT * INTO v_block FROM bus_seat_blocks
    WHERE product_id = p_product_id AND seat_id = p_seat_id AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Aucun blocage actif trouvé pour cette place');
    END IF;
    
    UPDATE bus_seat_blocks
    SET is_active = FALSE, unblocked_by = p_unblocked_by, unblocked_at = NOW()
    WHERE id = v_block.id;
    
    RETURN jsonb_build_object('success', TRUE, 'message', 'Place débloquée avec succès');
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir la disponibilité avec blocages
CREATE OR REPLACE FUNCTION get_bus_seat_availability_with_blocks(p_product_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_product RECORD;
    v_seat_map JSONB;
    v_reserved_seats TEXT[];
    v_blocked_seats TEXT[];
    v_available_seats JSONB;
BEGIN
    SELECT p.id, p.name, p.total_seats, p.seat_map, p.bus_configuration INTO v_product
    FROM products p
    WHERE p.id::text = p_product_id AND p.type = 'ticket_voyage' AND p.is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Produit non trouvé');
    END IF;
    
    SELECT ARRAY_AGG(br.seat_id) INTO v_reserved_seats FROM bus_reservations br
    WHERE br.product_id = p_product_id AND br.status IN ('pending', 'confirmed')
        AND (br.expires_at IS NULL OR br.expires_at > NOW());
    
    SELECT ARRAY_AGG(bsb.seat_id) INTO v_blocked_seats FROM bus_seat_blocks bsb
    WHERE bsb.product_id = p_product_id AND bsb.is_active = TRUE;
    
    IF v_product.seat_map IS NULL THEN
        v_seat_map := jsonb_build_array();
    ELSE
        v_seat_map := v_product.seat_map;
    END IF;
    
    v_seat_map := (
        SELECT jsonb_agg(
            CASE 
                WHEN seat->>'seat_id' = ANY(v_blocked_seats) THEN
                    seat || jsonb_build_object('available', FALSE, 'status', 'blocked', 'blocked_reason', 'maintenance')
                WHEN seat->>'seat_id' = ANY(v_reserved_seats) THEN
                    seat || jsonb_build_object('available', FALSE, 'status', 'reserved')
                ELSE
                    seat || jsonb_build_object('available', TRUE, 'status', 'available')
            END
        )
        FROM jsonb_array_elements(v_seat_map) AS seat
    );
    
    v_available_seats := jsonb_build_object(
        'total_seats', v_product.total_seats,
        'reserved_count', COALESCE(array_length(v_reserved_seats, 1), 0),
        'blocked_count', COALESCE(array_length(v_blocked_seats, 1), 0),
        'available_count', GREATEST(0, 
            COALESCE(v_product.total_seats, 0) 
            - COALESCE(array_length(v_reserved_seats, 1), 0)
            - COALESCE(array_length(v_blocked_seats, 1), 0)
        ),
        'reserved_seats', COALESCE(to_jsonb(v_reserved_seats), '[]'::jsonb),
        'blocked_seats', COALESCE(to_jsonb(v_blocked_seats), '[]'::jsonb),
        'seats', v_seat_map
    );
    
    RETURN jsonb_build_object('success', TRUE, 'availability', v_available_seats);
END;
$$ LANGUAGE plpgsql;

-- Vue pour les blocages actifs avec détails
CREATE OR REPLACE VIEW bus_active_seat_blocks AS
SELECT 
    bsb.id, bsb.product_id, bsb.seat_id, bsb.seat_number,
    bsb.reason, bsb.reason_details, bsb.blocked_by, bsb.blocked_at,
    u.nom_complet as blocked_by_name, p.name as product_name, p.numero_bus
FROM bus_seat_blocks bsb
JOIN users u ON u.id = bsb.blocked_by
JOIN products p ON p.id::text = bsb.product_id
WHERE bsb.is_active = TRUE
ORDER BY bsb.blocked_at DESC;


-- Migration: Tables complémentaires bus, fidélité, chat support, prix négociés et assurances
-- Date: 2026-01-31
-- Description: Intègre les tables manquantes pour bus (ratings, return trips), fidélité, chat support, prix négociés et assurances
-- Compatible SQLx offline mode

-- ============================================================================
-- 1. AVIS TICKETS BUS ⭐
-- ============================================================================

CREATE TABLE IF NOT EXISTS bus_ticket_ratings (
    id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(100) NOT NULL,
    payment_id VARCHAR(100) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    categories JSONB, -- ['punctuality', 'comfort', 'cleanliness', 'staff', 'value']
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(ticket_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rating_ticket_user ON bus_ticket_ratings(ticket_id, user_id);
CREATE INDEX IF NOT EXISTS idx_rating_ticket ON bus_ticket_ratings(ticket_id);
CREATE INDEX IF NOT EXISTS idx_rating_user ON bus_ticket_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_rating_created ON bus_ticket_ratings(created_at);

COMMENT ON TABLE bus_ticket_ratings IS 'Avis et notations des utilisateurs sur leurs tickets de bus';

-- ============================================================================
-- 2. SYSTÈME ALLER-RETOUR BUS 🔄
-- ============================================================================

-- Table pour les demandes de retour
CREATE TABLE IF NOT EXISTS return_trip_requests (
    id TEXT PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS TEXT),
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

CREATE INDEX IF NOT EXISTS idx_return_requests_user ON return_trip_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_trip_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_route ON return_trip_requests(return_from, return_to);
CREATE INDEX IF NOT EXISTS idx_return_requests_date ON return_trip_requests(preferred_return_date);
CREATE INDEX IF NOT EXISTS idx_return_requests_pending ON return_trip_requests(status, preferred_return_date) 
    WHERE status = 'pending';

-- Table pour les places pré-réservées (retour)
CREATE TABLE IF NOT EXISTS prebooked_return_seats (
    id TEXT PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS TEXT),
    return_request_id TEXT NOT NULL REFERENCES return_trip_requests(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL, -- Bus retour
    seat_ids TEXT[] NOT NULL, -- Places pré-réservées
    passenger_names TEXT[] NOT NULL,
    
    status VARCHAR(20) DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'released')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_prebooked_seats_product ON prebooked_return_seats(product_id);
CREATE INDEX IF NOT EXISTS idx_prebooked_seats_request ON prebooked_return_seats(return_request_id);

-- Fonction pour matcher automatiquement les demandes de retour
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
        AND rtr.return_from = p.metadata->>'arrival_city'
        AND rtr.return_to = p.metadata->>'departure_city'
        -- Match date (avec flexibilité)
        AND p.metadata->>'departure_date' BETWEEN 
            (rtr.preferred_return_date::date - INTERVAL '1 day' * rtr.date_flexibility_days)::TEXT
            AND (rtr.preferred_return_date::date + INTERVAL '1 day' * rtr.date_flexibility_days)::TEXT
        -- Vérifier qu'il y a assez de places
        AND COALESCE(p.total_seats, 0) >= rtr.number_of_seats;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour pré-réserver les places du retour
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

COMMENT ON TABLE return_trip_requests IS 'Demandes de trajet retour avec matching automatique quand bus créé';
COMMENT ON COLUMN return_trip_requests.already_paid IS 'TRUE si payé avec aller, FALSE si à payer séparément';
COMMENT ON COLUMN return_trip_requests.date_flexibility_days IS 'Flexibilité en jours (±X jours acceptable)';
COMMENT ON TABLE prebooked_return_seats IS 'Places pré-réservées pour trajets retour (déjà payées)';

-- ============================================================================
-- 3. PROGRAMME FIDÉLITÉ 🎁
-- ============================================================================

-- Table des transactions de fidélité
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('earned', 'redeemed', 'expired')),
    points INTEGER NOT NULL CHECK (points > 0),
    description TEXT NOT NULL,
    timestamp BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    expiry_date BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_user_id ON loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_timestamp ON loyalty_transactions(timestamp);

-- Table des récompenses disponibles
CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    points_cost INTEGER NOT NULL CHECK (points_cost > 0),
    discount_percent INTEGER CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_amount INTEGER CHECK (discount_amount >= 0),
    category VARCHAR(50) NOT NULL CHECK (category IN ('discount', 'free_ticket', 'upgrade', 'cashback')),
    available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les récompenses par défaut
INSERT INTO loyalty_rewards (id, name, description, points_cost, discount_percent, category, available)
VALUES
    ('discount_5', 'Réduction 5%', '5% de réduction sur votre prochaine réservation', 100, 5, 'discount', TRUE),
    ('discount_10', 'Réduction 10%', '10% de réduction sur votre prochaine réservation', 200, 10, 'discount', TRUE),
    ('discount_15', 'Réduction 15%', '15% de réduction sur votre prochaine réservation', 300, 15, 'discount', TRUE),
    ('free_ticket', 'Ticket gratuit', 'Un ticket gratuit jusqu''à 5000 FCFA', 500, NULL, 'free_ticket', TRUE)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE loyalty_transactions IS 'Transactions du programme de fidélité (points gagnés/utilisés)';
COMMENT ON TABLE loyalty_rewards IS 'Récompenses disponibles dans le programme de fidélité';

-- ============================================================================
-- 4. CHAT SUPPORT 💬
-- ============================================================================

-- Table des sessions de chat
CREATE TABLE IF NOT EXISTS chat_support_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'closed')),
    topic VARCHAR(200),
    agent_name VARCHAR(200),
    agent_avatar TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_user_id ON chat_support_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_status ON chat_support_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_last_message ON chat_support_sessions(last_message_at);

-- Table des messages de chat
CREATE TABLE IF NOT EXISTS chat_support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_support_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'support')),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    read BOOLEAN DEFAULT FALSE,
    attachments JSONB
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_support_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_support_messages(timestamp);

COMMENT ON TABLE chat_support_sessions IS 'Sessions de chat support entre utilisateurs et agents';
COMMENT ON TABLE chat_support_messages IS 'Messages échangés dans les sessions de chat support';

-- ============================================================================
-- 5. PRIX NÉGOCIÉS 💰
-- ============================================================================

CREATE TABLE IF NOT EXISTS negotiated_prices (
    id SERIAL PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES private_conversations(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER,
    merchant_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_price_cents BIGINT NOT NULL,
    negotiated_price_cents BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_negotiated_prices_conversation_id ON negotiated_prices(conversation_id);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_service_id ON negotiated_prices(service_id);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_client_user_id ON negotiated_prices(client_user_id);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_merchant_user_id ON negotiated_prices(merchant_user_id);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_status ON negotiated_prices(status);
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_expires_at ON negotiated_prices(expires_at);

-- Index composite pour requêtes courantes
CREATE INDEX IF NOT EXISTS idx_negotiated_prices_lookup 
ON negotiated_prices(conversation_id, service_id, product_index, client_user_id, status);

-- Contrainte UNIQUE pour éviter les doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_negotiated_prices_unique_pending
ON negotiated_prices(conversation_id, service_id, COALESCE(product_index, -1), client_user_id)
WHERE status = 'pending';

COMMENT ON TABLE negotiated_prices IS 'Offres de prix négociés entre prestataire et client';
COMMENT ON COLUMN negotiated_prices.status IS 'pending: en attente, accepted: acceptée, rejected: rejetée, expired: expirée, cancelled: annulée';
COMMENT ON COLUMN negotiated_prices.product_index IS 'Index du produit dans le service (NULL pour le service entier)';

-- ============================================================================
-- 6. RÉSERVATIONS SPÉCIALISÉES (si n'existe pas) 📋
-- ============================================================================

-- Table pour réservations services spécialisés (covoiturage, hôtels, pharmacie, etc.)
CREATE TABLE IF NOT EXISTS specialized_reservations (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL, -- "pharmacie", "hopital", "laboratoire", "covoiturage", "taxi", "agence_voyage"
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prestataire_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    reservation_type VARCHAR(50) NOT NULL, -- "rdv", "place", "course", "ticket"
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'expired')),
    
    requested_date TIMESTAMP WITH TIME ZONE,
    confirmed_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Paiement
    amount NUMERIC(10, 2),
    currency VARCHAR(10),
    payment_status VARCHAR(20), -- "pending", "paid", "refunded"
    payment_method VARCHAR(50), -- "mobile_money", "card", "cash"
    
    notes TEXT,
    prestataire_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_specialized_reservations_service_id ON specialized_reservations(service_id);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_user_id ON specialized_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_prestataire_id ON specialized_reservations(prestataire_id);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_status ON specialized_reservations(status);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_service_type ON specialized_reservations(service_type);

-- Table des avis et ratings services spécialisés
CREATE TABLE IF NOT EXISTS specialized_ratings (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prestataire_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    
    -- Ratings détaillés (optionnels)
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
    punctuality_rating INTEGER CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
    price_rating INTEGER CHECK (price_rating >= 1 AND price_rating <= 5),
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    
    reservation_id INTEGER REFERENCES specialized_reservations(id) ON DELETE SET NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false, -- Client a utilisé le service
    helpful_count INTEGER NOT NULL DEFAULT 0, -- Nombre de "utile"
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Un utilisateur ne peut laisser qu'un seul avis par service
    UNIQUE(service_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_specialized_ratings_service_id ON specialized_ratings(service_id);
CREATE INDEX IF NOT EXISTS idx_specialized_ratings_user_id ON specialized_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_specialized_ratings_prestataire_id ON specialized_ratings(prestataire_id);
CREATE INDEX IF NOT EXISTS idx_specialized_ratings_rating ON specialized_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_specialized_ratings_helpful_count ON specialized_ratings(helpful_count DESC);

-- Table pour votes "utile" sur les avis
CREATE TABLE IF NOT EXISTS rating_helpful_votes (
    id SERIAL PRIMARY KEY,
    rating_id INTEGER NOT NULL REFERENCES specialized_ratings(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Un utilisateur ne peut voter qu'une fois par avis
    UNIQUE(rating_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rating_helpful_votes_rating_id ON rating_helpful_votes(rating_id);
CREATE INDEX IF NOT EXISTS idx_rating_helpful_votes_user_id ON rating_helpful_votes(user_id);

-- ============================================================================
-- 7. ASSURANCE COVOITURAGE 🛡️
-- ============================================================================

CREATE TABLE IF NOT EXISTS covoiturage_insurance (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES specialized_reservations(id) ON DELETE CASCADE,
    passenger_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    insurance_provider TEXT, -- 'internal', 'external', 'partner'
    policy_number TEXT,
    coverage_amount DECIMAL(10,2), -- Montant couverture
    coverage_type TEXT DEFAULT 'basic' CHECK (coverage_type IN ('basic', 'premium', 'full')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_covoiturage_insurance_reservation ON covoiturage_insurance(reservation_id);
CREATE INDEX IF NOT EXISTS idx_covoiturage_insurance_passenger ON covoiturage_insurance(passenger_user_id);
CREATE INDEX IF NOT EXISTS idx_covoiturage_insurance_status ON covoiturage_insurance(status);
CREATE INDEX IF NOT EXISTS idx_covoiturage_insurance_dates ON covoiturage_insurance(start_date, end_date);

-- Table QR codes réservations (covoiturage et autres)
CREATE TABLE IF NOT EXISTS reservation_qr_codes (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES specialized_reservations(id) ON DELETE CASCADE,
    qr_code TEXT NOT NULL UNIQUE, -- Code QR unique
    qr_code_url TEXT, -- URL image QR code
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'expired', 'cancelled')),
    validated_at TIMESTAMPTZ,
    validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Conducteur qui valide
    expires_at TIMESTAMPTZ NOT NULL, -- Expiration (ex: 2h après départ prévu)
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_qr_codes_reservation ON reservation_qr_codes(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_qr_codes_qr_code ON reservation_qr_codes(qr_code);
CREATE INDEX IF NOT EXISTS idx_reservation_qr_codes_status ON reservation_qr_codes(status);
CREATE INDEX IF NOT EXISTS idx_reservation_qr_codes_expires ON reservation_qr_codes(expires_at);

-- Fonction pour générer QR code unique
CREATE OR REPLACE FUNCTION generate_reservation_qr_code(reservation_id_param INTEGER)
RETURNS TEXT AS $$
DECLARE
    qr_code_value TEXT;
BEGIN
    -- Générer code unique : RESERVATION_ID + TIMESTAMP + RANDOM
    qr_code_value := 'COV-' || reservation_id_param || '-' || 
                     EXTRACT(EPOCH FROM NOW())::BIGINT || '-' ||
                     LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    RETURN qr_code_value;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE specialized_reservations IS 'Réservations pour services spécialisés (covoiturage, hôtels, pharmacie, etc.)';
COMMENT ON TABLE specialized_ratings IS 'Avis et ratings pour services spécialisés';
COMMENT ON TABLE rating_helpful_votes IS 'Votes "utile" sur les avis services spécialisés';
COMMENT ON TABLE hotel_meuble_reservations IS 'Réservations pour hôtels et meublés';
COMMENT ON TABLE covoiturage_insurance IS 'Assurance passagers pour trajets covoiturage';
COMMENT ON TABLE reservation_qr_codes IS 'QR codes pour validation réservations covoiturage';
COMMENT ON FUNCTION generate_reservation_qr_code(INTEGER) IS 'Génère un code QR unique pour une réservation';

-- ============================================================================
-- 8. RÉSERVATIONS HÔTELS/MEUBLÉS (si n'existe pas) 🏨
-- ============================================================================

-- Table pour réservations hôtels/meublés
CREATE TABLE IF NOT EXISTS hotel_meuble_reservations (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    number_of_guests INTEGER NOT NULL DEFAULT 1,
    number_of_rooms INTEGER NOT NULL DEFAULT 1,
    total_price DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'expired')),
    reservation_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_meuble_reservations_service ON hotel_meuble_reservations(service_id);
CREATE INDEX IF NOT EXISTS idx_hotel_meuble_reservations_user ON hotel_meuble_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_hotel_meuble_reservations_dates ON hotel_meuble_reservations(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_hotel_meuble_reservations_status ON hotel_meuble_reservations(status);

-- ============================================================================
-- 9. QR CODES RÉSERVATIONS HÔTELS 🏨
-- ============================================================================

CREATE TABLE IF NOT EXISTS hotel_reservation_qr_codes (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES hotel_meuble_reservations(id) ON DELETE CASCADE,
    qr_code TEXT NOT NULL UNIQUE,
    qr_type TEXT NOT NULL DEFAULT 'guest' CHECK (qr_type IN ('main', 'guest')),
    guest_label TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_reservation_qr_codes_reservation
    ON hotel_reservation_qr_codes(reservation_id);
CREATE INDEX IF NOT EXISTS idx_hotel_reservation_qr_codes_qr_code
    ON hotel_reservation_qr_codes(qr_code);

COMMENT ON TABLE hotel_reservation_qr_codes IS 'QR codes secondaires (titulaire/invités) pour réservations hôtels/meublés';

-- ============================================================================
-- TRIGGERS POUR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_bus_ticket_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bus_ticket_ratings_updated_at ON bus_ticket_ratings;
CREATE TRIGGER trigger_update_bus_ticket_ratings_updated_at
    BEFORE UPDATE ON bus_ticket_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_bus_ticket_ratings_updated_at();

CREATE OR REPLACE FUNCTION update_return_trip_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_return_trip_requests_updated_at ON return_trip_requests;
CREATE TRIGGER trigger_update_return_trip_requests_updated_at
    BEFORE UPDATE ON return_trip_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_return_trip_requests_updated_at();

CREATE OR REPLACE FUNCTION update_loyalty_rewards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_loyalty_rewards_updated_at ON loyalty_rewards;
CREATE TRIGGER trigger_update_loyalty_rewards_updated_at
    BEFORE UPDATE ON loyalty_rewards
    FOR EACH ROW
    EXECUTE FUNCTION update_loyalty_rewards_updated_at();

CREATE OR REPLACE FUNCTION update_negotiated_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_negotiated_prices_updated_at ON negotiated_prices;
CREATE TRIGGER trigger_update_negotiated_prices_updated_at
    BEFORE UPDATE ON negotiated_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_negotiated_prices_updated_at();

CREATE OR REPLACE FUNCTION update_covoiturage_insurance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_covoiturage_insurance_updated_at ON covoiturage_insurance;
CREATE TRIGGER trigger_update_covoiturage_insurance_updated_at
    BEFORE UPDATE ON covoiturage_insurance
    FOR EACH ROW
    EXECUTE FUNCTION update_covoiturage_insurance_updated_at();

CREATE OR REPLACE FUNCTION update_reservation_qr_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reservation_qr_codes_updated_at ON reservation_qr_codes;
CREATE TRIGGER trigger_update_reservation_qr_codes_updated_at
    BEFORE UPDATE ON reservation_qr_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_reservation_qr_codes_updated_at();

CREATE OR REPLACE FUNCTION update_specialized_reservations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_specialized_reservations_updated_at ON specialized_reservations;
CREATE TRIGGER trigger_update_specialized_reservations_updated_at
    BEFORE UPDATE ON specialized_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_specialized_reservations_updated_at();

CREATE OR REPLACE FUNCTION update_specialized_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_specialized_ratings_updated_at ON specialized_ratings;
CREATE TRIGGER trigger_update_specialized_ratings_updated_at
    BEFORE UPDATE ON specialized_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_specialized_ratings_updated_at();

CREATE OR REPLACE FUNCTION update_hotel_meuble_reservations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_hotel_meuble_reservations_updated_at ON hotel_meuble_reservations;
CREATE TRIGGER trigger_update_hotel_meuble_reservations_updated_at
    BEFORE UPDATE ON hotel_meuble_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_hotel_meuble_reservations_updated_at();


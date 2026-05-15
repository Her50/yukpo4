-- ✅ NOUVEAU: Migration pour réservations hôtels et meublés
-- Date: 2026-01-26
-- Description: Système de réservation avec paiement pour hôtels et meublés (nuitées)

-- Table des réservations hôtels/meublés
CREATE TABLE IF NOT EXISTS hotel_meuble_reservations (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    
    -- Dates de séjour
    date_arrivee DATE NOT NULL,
    date_depart DATE NOT NULL,
    nombre_nuitees INTEGER NOT NULL GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (date_depart - date_arrivee)) / 86400
    ) STORED,
    
    -- Informations réservation
    nombre_adultes INTEGER NOT NULL DEFAULT 1,
    nombre_enfants INTEGER DEFAULT 0,
    nombre_chambres INTEGER NOT NULL DEFAULT 1,
    
    -- Prix
    prix_nuitee DECIMAL(10, 2) NOT NULL, -- Prix par nuitée au moment de la réservation
    prix_total DECIMAL(10, 2) NOT NULL, -- Prix total (prix_nuitee * nombre_nuitees)
    frais_service DECIMAL(10, 2) DEFAULT 0, -- Frais de service optionnels
    reduction DECIMAL(10, 2) DEFAULT 0, -- Réduction éventuelle
    montant_total DECIMAL(10, 2) NOT NULL, -- Montant total à payer
    
    -- Paiement
    montant_avance DECIMAL(10, 2) DEFAULT 0, -- Montant payé en avance
    montant_restant DECIMAL(10, 2) GENERATED ALWAYS AS (
        montant_total - montant_avance
    ) STORED,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- "pending", "advance_paid", "fully_paid", "cancelled", "refunded"
    payment_method VARCHAR(50), -- "mobile_money", "card", "cash", "bank_transfer"
    payment_transaction_id VARCHAR(255), -- ID transaction paiement
    
    -- Statut réservation
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- "pending", "confirmed", "checked_in", "checked_out", "cancelled"
    
    -- Dates importantes
    date_confirmation TIMESTAMPTZ, -- Date de confirmation (après paiement)
    date_check_in TIMESTAMPTZ, -- Date d'arrivée effective
    date_check_out TIMESTAMPTZ, -- Date de départ effective
    date_annulation TIMESTAMPTZ, -- Date d'annulation si applicable
    
    -- Informations client
    nom_client VARCHAR(255),
    telephone_client VARCHAR(50),
    email_client VARCHAR(255),
    notes TEXT, -- Notes spéciales du client
    notes_proprietaire TEXT, -- Notes du propriétaire
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT check_dates CHECK (date_depart > date_arrivee),
    CONSTRAINT check_nuitees CHECK (nombre_nuitees > 0),
    CONSTRAINT check_montants CHECK (montant_total >= 0 AND montant_avance >= 0)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_property_id ON hotel_meuble_reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_user_id ON hotel_meuble_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_service_id ON hotel_meuble_reservations(service_id);
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_status ON hotel_meuble_reservations(status);
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_payment_status ON hotel_meuble_reservations(payment_status);
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_dates ON hotel_meuble_reservations(date_arrivee, date_depart);
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_created_at ON hotel_meuble_reservations(created_at DESC);

-- Index composite pour vérification disponibilité
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_dates_status 
ON hotel_meuble_reservations(property_id, date_arrivee, date_depart, status) 
WHERE status IN ('pending', 'confirmed', 'checked_in');

-- Table des paiements réservations (historique)
CREATE TABLE IF NOT EXISTS hotel_reservation_payments (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES hotel_meuble_reservations(id) ON DELETE CASCADE,
    
    -- Montant
    montant DECIMAL(10, 2) NOT NULL,
    type_paiement VARCHAR(20) NOT NULL, -- "advance", "full", "remaining"
    
    -- Paiement
    payment_method VARCHAR(50) NOT NULL,
    payment_transaction_id VARCHAR(255),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- "pending", "completed", "failed", "refunded"
    
    -- Métadonnées
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payment_confirmed_at TIMESTAMPTZ,
    payment_details JSONB, -- Détails supplémentaires (référence, etc.)
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour paiements
CREATE INDEX IF NOT EXISTS idx_hotel_payments_reservation_id ON hotel_reservation_payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_hotel_payments_status ON hotel_reservation_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_hotel_payments_date ON hotel_reservation_payments(payment_date DESC);

-- Fonction pour vérifier disponibilité (dépréciée - utiliser check_hotel_availability_hybrid)
CREATE OR REPLACE FUNCTION check_hotel_availability(
    p_property_id INTEGER,
    p_date_arrivee DATE,
    p_date_depart DATE,
    p_exclude_reservation_id INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Déléguer à la fonction hybride
    RETURN check_hotel_availability_hybrid(p_property_id, p_date_arrivee, p_date_depart, p_exclude_reservation_id);
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_hotel_reservation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hotel_reservation_updated_at
BEFORE UPDATE ON hotel_meuble_reservations
FOR EACH ROW
EXECUTE FUNCTION update_hotel_reservation_updated_at();

-- Vue pour statistiques réservations
CREATE OR REPLACE VIEW hotel_reservation_stats AS
SELECT 
    property_id,
    COUNT(*) as total_reservations,
    COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_reservations,
    COUNT(*) FILTER (WHERE status = 'checked_out') as completed_reservations,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_reservations,
    SUM(montant_total) FILTER (WHERE payment_status = 'fully_paid') as total_revenue,
    AVG(nombre_nuitees) as avg_nuitees,
    AVG(montant_total) as avg_amount
FROM hotel_meuble_reservations
GROUP BY property_id;


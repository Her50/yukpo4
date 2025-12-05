-- ✅ Migration : Assurance passagers + QR code pour covoiturage
-- Date: 2025-01-29

-- 1. Table assurance passagers
CREATE TABLE IF NOT EXISTS covoiturage_insurance (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
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

-- 2. Table QR codes réservations
CREATE TABLE IF NOT EXISTS reservation_qr_codes (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
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

-- 3. Ajouter colonne assurance dans reservations
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS insurance_included BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS insurance_coverage_amount DECIMAL(10,2);

-- 4. Fonction pour générer QR code unique
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

-- 5. Commentaires
COMMENT ON TABLE covoiturage_insurance IS 'Assurance passagers pour trajets covoiturage';
COMMENT ON TABLE reservation_qr_codes IS 'QR codes pour validation réservations covoiturage';
COMMENT ON FUNCTION generate_reservation_qr_code(INTEGER) IS 'Génère un code QR unique pour une réservation';


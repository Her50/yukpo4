-- ✅ NOUVEAU 2026-01-27 : QR codes secondaires pour réservations hôtels/meublés
-- Permet de générer des QR "invité / co‑chambrier" distincts du QR principal.

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

COMMENT ON TABLE hotel_reservation_qr_codes IS 'QR codes secondaires (titulaire/ invités) pour réservations hôtels/meublés';






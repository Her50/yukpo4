-- Migration: Création de la table appointment_slots pour le système de réservation
-- Date: 2026-03-03

-- 1. Créer la table appointment_slots
CREATE TABLE IF NOT EXISTS appointment_slots (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_bookings INTEGER NOT NULL DEFAULT 1,
    current_bookings INTEGER NOT NULL DEFAULT 0,
    consultation_type TEXT,
    price NUMERIC(12,2),
    currency TEXT DEFAULT 'XAF',
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index unique pour éviter les doublons de créneaux
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_slots_unique
    ON appointment_slots(service_id, slot_date, start_time, end_time);

-- 3. Index pour recherche rapide par service et date
CREATE INDEX IF NOT EXISTS idx_appointment_slots_service_date
    ON appointment_slots(service_id, slot_date, is_active);

-- 4. Ajouter les colonnes manquantes dans specialized_reservations
ALTER TABLE specialized_reservations
    ADD COLUMN IF NOT EXISTS slot_id INTEGER REFERENCES appointment_slots(id);

ALTER TABLE specialized_reservations
    ADD COLUMN IF NOT EXISTS reservation_date DATE;

ALTER TABLE specialized_reservations
    ADD COLUMN IF NOT EXISTS reservation_time TEXT;

-- 5. Index sur slot_id dans specialized_reservations
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_slot_id
    ON specialized_reservations(slot_id);

-- 6. Vérification
SELECT 'appointment_slots table created' AS status, COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_name = 'appointment_slots';

SELECT 'specialized_reservations columns added' AS status,
       EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'specialized_reservations' AND column_name = 'slot_id') AS has_slot_id,
       EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'specialized_reservations' AND column_name = 'reservation_date') AS has_reservation_date,
       EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'specialized_reservations' AND column_name = 'reservation_time') AS has_reservation_time;

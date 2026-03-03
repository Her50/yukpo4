-- Migration: Corrections système tickets bus
-- Date: 2026-03-03
-- BUG 6: Ajouter cancelled_at dans bus_reservations
-- BUG 7: Ajouter return_date, return_time dans bus_ticket_payments

-- 1. Ajouter cancelled_at dans bus_reservations
ALTER TABLE bus_reservations
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. Ajouter return_date et return_time dans bus_ticket_payments
ALTER TABLE bus_ticket_payments
    ADD COLUMN IF NOT EXISTS return_date TEXT;

ALTER TABLE bus_ticket_payments
    ADD COLUMN IF NOT EXISTS return_time TEXT;

-- 3. Vérification
SELECT 'bus_reservations.cancelled_at' AS col,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='bus_reservations' AND column_name='cancelled_at') AS exists;

SELECT 'bus_ticket_payments.return_date' AS col,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='bus_ticket_payments' AND column_name='return_date') AS exists;

SELECT 'bus_ticket_payments.return_time' AS col,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='bus_ticket_payments' AND column_name='return_time') AS exists;

-- Migration: Ajout des colonnes return_date et return_time à bus_ticket_payments
-- Date: 2025-11-27
-- Description: Permet de stocker la date et l'heure de retour lors du paiement aller-retour

-- 1. Ajouter colonnes return_date et return_time
ALTER TABLE bus_ticket_payments 
ADD COLUMN IF NOT EXISTS return_date VARCHAR(20),
ADD COLUMN IF NOT EXISTS return_time VARCHAR(10);

-- 2. Index pour recherche par date/heure retour
CREATE INDEX IF NOT EXISTS idx_bus_payments_return_date ON bus_ticket_payments(return_date) WHERE return_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bus_payments_return_time ON bus_ticket_payments(return_time) WHERE return_time IS NOT NULL;

-- 3. Commentaires
COMMENT ON COLUMN bus_ticket_payments.return_date IS 'Date de retour souhaitée (format DD/MM/YYYY) pour tickets aller-retour';
COMMENT ON COLUMN bus_ticket_payments.return_time IS 'Heure de retour souhaitée (format HH:MM) pour tickets aller-retour';


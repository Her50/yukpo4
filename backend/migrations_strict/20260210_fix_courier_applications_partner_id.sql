-- Migration: S'assurer que partner_id existe dans courier_applications
-- Date: 2026-02-10
-- Description: Corrige l'erreur "column partner_id does not exist"

-- Ajouter partner_id à courier_applications si n'existe pas
ALTER TABLE courier_applications 
ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES delivery_partners(id) ON DELETE SET NULL;

-- Créer l'index si n'existe pas
CREATE INDEX IF NOT EXISTS idx_courier_applications_partner ON courier_applications(partner_id);


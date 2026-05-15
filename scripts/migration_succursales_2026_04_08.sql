-- ============================================================
-- Migration succursales pharmacies + agences de voyage
-- Date: 2026-04-08
-- Auteur: Yukpo backend
-- ============================================================

-- 1. Succursales pharmacie : parent_pharmacy_id sur pharmacies
ALTER TABLE pharmacies
    ADD COLUMN IF NOT EXISTS parent_pharmacy_id INTEGER REFERENCES pharmacies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pharmacies_parent_id ON pharmacies(parent_pharmacy_id);

-- 2. Succursales agence : parent_agence_id sur agences_voyage
ALTER TABLE agences_voyage
    ADD COLUMN IF NOT EXISTS parent_agence_id INTEGER REFERENCES agences_voyage(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_agences_parent_id ON agences_voyage(parent_agence_id);

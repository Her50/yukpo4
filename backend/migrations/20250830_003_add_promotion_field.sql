-- Migration pour ajouter le champ promotion aux services
-- Date: 2025-08-30

-- Ajouter une colonne promotion à la table services
ALTER TABLE services ADD COLUMN IF NOT EXISTS promotion JSONB;

-- Créer un index sur le champ promotion pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_services_promotion ON services USING GIN (promotion);

-- Commentaire sur la structure attendue du champ promotion
COMMENT ON COLUMN services.promotion IS 'Champ JSONB contenant les informations de promotion (ex: {"active": true, "type": "reduction", "valeur": "20%", "description": "Réduction de 20%", "date_fin": "2025-12-31"})'; 
-- Script simple pour ajouter le champ promotion à la table services
-- Base: yukpo_db
-- Utilisateur: postgres

-- Ajouter la colonne promotion
ALTER TABLE services ADD COLUMN IF NOT EXISTS promotion JSONB;

-- Créer un index sur le champ promotion pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_services_promotion ON services USING GIN (promotion);

-- Commentaire sur la structure attendue du champ promotion
COMMENT ON COLUMN services.promotion IS 'Champ JSONB contenant les informations de promotion (ex: {"active": true, "type": "reduction", "valeur": "20%", "description": "Réduction de 20%", "date_fin": "2025-12-31"})';

-- Vérifier que la colonne a bien été ajoutée
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'services' AND column_name = 'promotion';

-- Message de confirmation
SELECT 'Migration de promotion appliquée avec succès!' as status; 
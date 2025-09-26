-- Migration pour ajouter le coût proratisé de réactivation pour les services tarissables
-- Date: 2024-12-20
-- Description: Ajoute une colonne pour stocker le coût proratisé de réactivation des services tarissables

-- Ajouter la colonne prorated_reactivation_cost à la table services
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS prorated_reactivation_cost INTEGER DEFAULT NULL;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN services.prorated_reactivation_cost IS 'Coût proratisé de réactivation pour les services tarissables (en FCFA)';

-- Créer un index pour optimiser les requêtes sur les services tarissables
CREATE INDEX IF NOT EXISTS idx_services_tarissable_reactivation 
ON services (is_tarissable, prorated_reactivation_cost) 
WHERE is_tarissable = TRUE;

-- Ajouter une contrainte pour s'assurer que le coût est positif
ALTER TABLE services 
ADD CONSTRAINT check_prorated_cost_positive 
CHECK (prorated_reactivation_cost IS NULL OR prorated_reactivation_cost > 0);

-- Mettre à jour les services tarissables existants avec un coût par défaut
UPDATE services 
SET prorated_reactivation_cost = 1000  -- Coût de base 1000 FCFA
WHERE is_tarissable = TRUE 
  AND prorated_reactivation_cost IS NULL;



-- Migration directe pour ajouter les champs média aux services
-- Date: 2025-08-30

-- Ajouter les colonnes média à la table services
ALTER TABLE services ADD COLUMN IF NOT EXISTS logo VARCHAR(500);
ALTER TABLE services ADD COLUMN IF NOT EXISTS banniere VARCHAR(500);
ALTER TABLE services ADD COLUMN IF NOT EXISTS images_realisations TEXT[];
ALTER TABLE services ADD COLUMN IF NOT EXISTS videos TEXT[];

-- Ajouter la colonne pour le type de média spécifique au service
ALTER TABLE media ADD COLUMN IF NOT EXISTS service_media_type VARCHAR(50);

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_services_logo ON services(logo) WHERE logo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_banniere ON services(banniere) WHERE banniere IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_service_media_type ON media(service_media_type);

-- Vérifier que les colonnes ont été ajoutées
SELECT 'Migration terminée avec succès!' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'services' 
AND column_name IN ('logo', 'banniere', 'images_realisations', 'videos') 
ORDER BY column_name; 
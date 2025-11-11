-- Migration pour ajouter les champs média aux services
-- Date: 2025-08-30

-- Ajouter les colonnes média à la table services
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS logo VARCHAR(500),
ADD COLUMN IF NOT EXISTS banniere VARCHAR(500),
ADD COLUMN IF NOT EXISTS images_realisations TEXT[], -- Array de chemins d'images
ADD COLUMN IF NOT EXISTS videos TEXT[]; -- Array de chemins de vidéos

-- Ajouter des commentaires pour documenter les nouveaux champs
COMMENT ON COLUMN services.logo IS 'Chemin vers le logo du service';
COMMENT ON COLUMN services.banniere IS 'Chemin vers la bannière du service';
COMMENT ON COLUMN services.images_realisations IS 'Array des chemins vers les images de réalisations';
COMMENT ON COLUMN services.videos IS 'Array des chemins vers les vidéos de présentation';

-- Créer des index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_services_logo ON services(logo) WHERE logo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_banniere ON services(banniere) WHERE banniere IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_has_media ON services(id) WHERE logo IS NOT NULL OR banniere IS NOT NULL OR array_length(images_realisations, 1) > 0 OR array_length(videos, 1) > 0;

-- Mettre à jour la table media pour lier les fichiers aux services
-- Ajouter une colonne pour le type de média spécifique au service
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS service_media_type VARCHAR(50); -- 'logo', 'banniere', 'image_realisation', 'video'

-- Ajouter des contraintes pour les types de média de service
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'service_media_type_check' AND table_name = 'media'
    ) THEN
        ALTER TABLE media ADD CONSTRAINT service_media_type_check 
        CHECK (service_media_type IN ('logo', 'banniere', 'image_realisation', 'video', 'audio'));
    END IF;
END $$;

-- Créer un index sur le nouveau champ
CREATE INDEX IF NOT EXISTS idx_media_service_media_type ON media(service_media_type);

-- Ajouter des commentaires
COMMENT ON COLUMN media.service_media_type IS 'Type de média spécifique au service (logo, banniere, image_realisation, video)';

-- Mettre à jour les services existants pour utiliser les nouveaux champs
-- Cette partie peut être exécutée manuellement si nécessaire
-- UPDATE services SET logo = (SELECT path FROM media WHERE service_id = services.id AND service_media_type = 'logo' LIMIT 1);
-- UPDATE services SET banniere = (SELECT path FROM media WHERE service_id = services.id AND service_media_type = 'banniere' LIMIT 1); 
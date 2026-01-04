-- Migration: Création de la table delivery_media pour optimiser le stockage des médias de livraison
-- Date: 2025-01-31
-- Description: Table dédiée pour les médias de livraison avec support S3/CDN, similaire à media pour services

-- Créer la table delivery_media
CREATE TABLE IF NOT EXISTS delivery_media (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    parcel_id UUID REFERENCES delivery_parcels(id) ON DELETE SET NULL,
    
    -- Informations média
    type TEXT NOT NULL CHECK (type IN ('image', 'video', 'audio', 'document')),
    path TEXT NOT NULL, -- Chemin S3/CDN
    media_type TEXT, -- Type MIME (image/jpeg, video/mp4, etc.)
    file_size BIGINT, -- Taille en bytes
    file_format TEXT, -- Format fichier (jpg, png, mp4, etc.)
    
    -- Métadonnées
    is_parcel_photo BOOLEAN NOT NULL DEFAULT TRUE, -- Photo du colis (TRUE) ou preuve de livraison (FALSE)
    is_proof_media BOOLEAN NOT NULL DEFAULT FALSE, -- Preuve de collecte/livraison
    proof_type TEXT CHECK (proof_type IN ('pickup', 'delivery', NULL)), -- Type de preuve si applicable
    
    -- Ordre d'affichage
    display_order INTEGER NOT NULL DEFAULT 0,
    
    -- Analyse IA (optionnel, pour futures améliorations)
    ai_description TEXT,
    ai_tags TEXT[],
    ai_metadata JSONB,
    ai_analyzed_at TIMESTAMPTZ,
    ai_model_used VARCHAR(100),
    ai_confidence DOUBLE PRECISION,
    
    -- Timestamps
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Métadonnées additionnelles
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_delivery_media_delivery_id ON delivery_media(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_media_parcel_id ON delivery_media(parcel_id) WHERE parcel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_media_type ON delivery_media(type);
CREATE INDEX IF NOT EXISTS idx_delivery_media_is_parcel_photo ON delivery_media(is_parcel_photo) WHERE is_parcel_photo = TRUE;
CREATE INDEX IF NOT EXISTS idx_delivery_media_is_proof ON delivery_media(is_proof_media, proof_type) WHERE is_proof_media = TRUE;
CREATE INDEX IF NOT EXISTS idx_delivery_media_display_order ON delivery_media(delivery_id, display_order);
CREATE INDEX IF NOT EXISTS idx_delivery_media_uploaded_at ON delivery_media(uploaded_at DESC);

-- Index composite pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_delivery_media_delivery_type ON delivery_media(delivery_id, type);
CREATE INDEX IF NOT EXISTS idx_delivery_media_delivery_proof ON delivery_media(delivery_id, is_proof_media, proof_type);

-- Index GIN pour recherche full-text dans ai_description
CREATE INDEX IF NOT EXISTS idx_delivery_media_ai_description_fulltext
    ON delivery_media USING GIN (to_tsvector('french', COALESCE(ai_description, '')));

-- Index GIN pour metadata JSONB
CREATE INDEX IF NOT EXISTS idx_delivery_media_metadata ON delivery_media USING GIN (metadata);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_delivery_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_delivery_media_updated_at ON delivery_media;
CREATE TRIGGER trigger_update_delivery_media_updated_at
    BEFORE UPDATE ON delivery_media
    FOR EACH ROW
    EXECUTE FUNCTION update_delivery_media_updated_at();

-- Commentaires
COMMENT ON TABLE delivery_media IS 'Médias associés aux livraisons (photos colis, preuves de livraison, etc.) avec support S3/CDN';
COMMENT ON COLUMN delivery_media.delivery_id IS 'ID de la livraison associée';
COMMENT ON COLUMN delivery_media.parcel_id IS 'ID du colis (optionnel, si média lié à un colis spécifique)';
COMMENT ON COLUMN delivery_media.type IS 'Type de média: image, video, audio, document';
COMMENT ON COLUMN delivery_media.path IS 'Chemin du fichier dans S3/CDN';
COMMENT ON COLUMN delivery_media.is_parcel_photo IS 'TRUE si photo du colis, FALSE si preuve de livraison/collecte';
COMMENT ON COLUMN delivery_media.is_proof_media IS 'TRUE si c''est une preuve de collecte ou livraison';
COMMENT ON COLUMN delivery_media.proof_type IS 'Type de preuve: pickup (collecte) ou delivery (livraison)';
COMMENT ON COLUMN delivery_media.display_order IS 'Ordre d''affichage des médias (pour galerie)';


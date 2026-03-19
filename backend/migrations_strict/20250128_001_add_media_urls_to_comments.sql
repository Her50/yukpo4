-- ✅ 2025-01-28: Ajout support médias (images/vidéos) dans commentaires produits
-- Migration pour permettre l'upload de médias dans les commentaires

-- Ajouter colonne media_urls (tableau JSONB d'URLs)
ALTER TABLE product_comments 
ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'::jsonb;

-- Créer index GIN pour recherche rapide dans media_urls
CREATE INDEX IF NOT EXISTS idx_product_comments_media_urls 
ON product_comments USING GIN (media_urls);

-- Index pour filtrer les commentaires avec médias
CREATE INDEX IF NOT EXISTS idx_product_comments_has_media 
ON product_comments (service_id, created_at DESC) 
WHERE jsonb_array_length(media_urls) > 0;

-- Commentaire
COMMENT ON COLUMN product_comments.media_urls IS 'Tableau JSONB contenant les URLs des médias (images/vidéos) attachés au commentaire. Format: [{"url": "...", "type": "image|video", "content_type": "..."}]';


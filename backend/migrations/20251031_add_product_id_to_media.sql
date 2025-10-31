-- Migration: Ajouter product_id et product_index à la table media
-- Date: 2025-10-31
-- Description: Permet de rattacher les médias à des produits spécifiques, pas juste au service
-- Problème résolu: Avant, les médias étaient rattachés au service uniquement
--                  Si un service avait 5 produits, impossible de savoir quelle image appartient à quel produit

-- 1. Ajouter les colonnes pour lier les médias aux produits spécifiques
ALTER TABLE media
ADD COLUMN IF NOT EXISTS product_id TEXT, -- ID du produit spécifique (format: uuid ou index)
ADD COLUMN IF NOT EXISTS product_index INTEGER, -- Index du produit dans service.data.produits[]
ADD COLUMN IF NOT EXISTS is_main_image BOOLEAN DEFAULT FALSE, -- Image principale du produit
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0; -- Ordre d'affichage (0 = première)

-- 2. Ajouter des commentaires
COMMENT ON COLUMN media.product_id IS 'ID du produit spécifique auquel ce média appartient';
COMMENT ON COLUMN media.product_index IS 'Index du produit dans service.data.produits[] (0-based)';
COMMENT ON COLUMN media.is_main_image IS 'Indique si c''est l''image principale du produit';
COMMENT ON COLUMN media.display_order IS 'Ordre d''affichage des médias (0 = premier, 1 = deuxième, etc.)';

-- 3. Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_media_product_id ON media(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_product_index ON media(product_index) WHERE product_index IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_service_product ON media(service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_media_main_image ON media(product_id, is_main_image) WHERE is_main_image = TRUE;

-- 4. Index composite pour requêtes courantes
CREATE INDEX IF NOT EXISTS idx_media_product_display 
ON media(product_id, display_order) WHERE product_id IS NOT NULL;

-- 5. Contrainte pour garantir qu'un produit a au plus 1 image principale
-- Note: Désactivé pour l'instant car peut causer des conflits lors de l'insertion
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_media_one_main_per_product 
-- ON media(product_id) WHERE is_main_image = TRUE AND product_id IS NOT NULL;

-- 6. Vue pour faciliter les requêtes de médias par produit
CREATE OR REPLACE VIEW product_media AS
SELECT 
    m.id as media_id,
    m.service_id,
    m.product_id,
    m.product_index,
    m.type,
    m.path,
    m.is_main_image,
    m.display_order,
    m.uploaded_at,
    m.ai_description,
    m.ai_tags,
    m.ai_category,
    s.user_id,
    s.category as service_category
FROM media m
JOIN services s ON s.id = m.service_id
WHERE m.product_id IS NOT NULL OR m.product_index IS NOT NULL
ORDER BY m.service_id, m.product_index, m.display_order;

COMMENT ON VIEW product_media IS 'Vue simplifiée des médias rattachés à des produits spécifiques';

-- 7. Fonction helper pour récupérer les médias d'un produit
CREATE OR REPLACE FUNCTION get_product_media(
    p_service_id INTEGER,
    p_product_index INTEGER,
    p_media_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    media_id INTEGER,
    type TEXT,
    path TEXT,
    is_main BOOLEAN,
    display_order INTEGER,
    ai_description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.type,
        m.path,
        m.is_main_image,
        m.display_order,
        m.ai_description
    FROM media m
    WHERE m.service_id = p_service_id
    AND m.product_index = p_product_index
    AND (p_media_type IS NULL OR m.type = p_media_type)
    ORDER BY 
        m.is_main_image DESC,  -- Image principale en premier
        m.display_order ASC,    -- Puis par ordre
        m.id ASC;               -- Puis par ID
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_product_media IS 'Récupère tous les médias d''un produit spécifique dans un ordre logique';

-- 8. Fonction pour définir l'image principale d'un produit
CREATE OR REPLACE FUNCTION set_main_product_image(
    p_media_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_service_id INTEGER;
    v_product_index INTEGER;
BEGIN
    -- Récupérer les infos du média
    SELECT service_id, product_index 
    INTO v_service_id, v_product_index
    FROM media 
    WHERE id = p_media_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Désactiver toutes les images principales de ce produit
    UPDATE media
    SET is_main_image = FALSE
    WHERE service_id = v_service_id
    AND product_index = v_product_index
    AND type = 'image';
    
    -- Définir cette image comme principale
    UPDATE media
    SET is_main_image = TRUE
    WHERE id = p_media_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_main_product_image IS 'Définit une image comme image principale d''un produit (désactive les autres)';


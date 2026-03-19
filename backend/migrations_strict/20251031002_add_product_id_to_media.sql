-- Migration: Ajouter product_id et product_index à la table media
-- Date: 2025-10-31
-- Description: Permet de rattacher les médias à des produits spécifiques, pas juste au service
-- Note: Compatible avec SQLx offline mode

-- Ajouter les colonnes pour lier les médias aux produits spécifiques
DO $$ 
BEGIN
    -- Colonne product_id (ID du produit)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='media' AND column_name='product_id'
    ) THEN
        ALTER TABLE media ADD COLUMN product_id TEXT;
        RAISE NOTICE 'Colonne product_id ajoutée à media';
    END IF;

    -- Colonne product_index (index dans service.data.produits[])
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='media' AND column_name='product_index'
    ) THEN
        ALTER TABLE media ADD COLUMN product_index INTEGER;
        RAISE NOTICE 'Colonne product_index ajoutée à media';
    END IF;

    -- Colonne is_main_image (image principale du produit)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='media' AND column_name='is_main_image'
    ) THEN
        ALTER TABLE media ADD COLUMN is_main_image BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Colonne is_main_image ajoutée à media';
    END IF;

    -- Colonne display_order (ordre d'affichage)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='media' AND column_name='display_order'
    ) THEN
        ALTER TABLE media ADD COLUMN display_order INTEGER DEFAULT 0;
        RAISE NOTICE 'Colonne display_order ajoutée à media';
    END IF;
END $$;

-- Commentaires pour documentation
COMMENT ON COLUMN media.product_id IS 'ID du produit spécifique auquel ce média appartient';
COMMENT ON COLUMN media.product_index IS 'Index du produit dans service.data.produits[] (0-based)';
COMMENT ON COLUMN media.is_main_image IS 'Indique si c''est l''image principale du produit';
COMMENT ON COLUMN media.display_order IS 'Ordre d''affichage des médias (0 = premier, 1 = deuxième, etc.)';

-- Créer des index pour améliorer les performances
DO $$
BEGIN
    -- Index sur product_id
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_media_product_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_media_product_id ON media(product_id) WHERE product_id IS NOT NULL;
        RAISE NOTICE 'Index idx_media_product_id créé';
    END IF;

    -- Index sur product_index
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_media_product_index' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_media_product_index ON media(product_index) WHERE product_index IS NOT NULL;
        RAISE NOTICE 'Index idx_media_product_index créé';
    END IF;

    -- Index composite service_id + product_index
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_media_service_product' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_media_service_product ON media(service_id, product_index);
        RAISE NOTICE 'Index idx_media_service_product créé';
    END IF;

    -- Index pour images principales
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_media_main_image' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_media_main_image ON media(product_id, is_main_image) WHERE is_main_image = TRUE;
        RAISE NOTICE 'Index idx_media_main_image créé';
    END IF;

    -- Index composite pour ordre d'affichage
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_media_product_display' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_media_product_display ON media(product_id, display_order) WHERE product_id IS NOT NULL;
        RAISE NOTICE 'Index idx_media_product_display créé';
    END IF;
END $$;

-- Fonction pour récupérer les médias d'un produit (compatible sqlx offline)
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
        COALESCE(m.is_main_image, FALSE),
        COALESCE(m.display_order, 0),
        m.ai_description
    FROM media m
    WHERE m.service_id = p_service_id
    AND m.product_index = p_product_index
    AND (p_media_type IS NULL OR m.type = p_media_type)
    ORDER BY 
        COALESCE(m.is_main_image, FALSE) DESC,
        COALESCE(m.display_order, 0) ASC,
        m.id ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_product_media IS 'Récupère tous les médias d''un produit spécifique dans un ordre logique';

-- Fonction pour définir l'image principale d'un produit (compatible sqlx offline)
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

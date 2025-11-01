-- Migration: Table image_analyses pour stockage et recherche hybride intelligente
-- Stocke les analyses IA des images pour matching sémantique avancé
-- Date: 2025-10-26
-- Compatible avec sqlx offline

-- ============================================
-- TABLE: image_analyses
-- Stocke toutes les analyses IA d'images
-- ============================================

CREATE TABLE IF NOT EXISTS image_analyses (
    -- Identifiant unique
    id SERIAL PRIMARY KEY,
    
    -- Liens avec les autres tables
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    media_id INTEGER REFERENCES media(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Résultats de l'analyse IA
    description TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    category_detected VARCHAR(100),
    marque VARCHAR(100),
    couleurs TEXT[] NOT NULL DEFAULT '{}',
    
    -- Caractéristiques détaillées (JSON flexible)
    caracteristiques_cles JSONB NOT NULL DEFAULT '{}',
    
    -- Requêtes de recherche générées (3 variantes)
    search_query_exact TEXT,      -- Recherche précise avec mots-clés exacts
    search_query_broad TEXT,       -- Recherche large avec synonymes
    search_query_semantic TEXT,    -- Description naturelle complète
    
    -- Métadonnées de l'analyse
    confiance FLOAT DEFAULT 0.0,
    model_used VARCHAR(50),        -- ex: "gpt-4-vision", "claude-3-opus"
    tokens_consumed INTEGER DEFAULT 0,
    cost_usd DECIMAL(10, 6) DEFAULT 0.0,
    
    -- Type d'analyse
    analysis_type VARCHAR(20) DEFAULT 'search', -- 'search' (recherche client) ou 'cataloging' (création produit)
    
    -- Horodatage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEX pour optimiser les recherches
-- ============================================

-- Index sur service_id pour retrouver l'analyse d'un service rapidement
CREATE INDEX IF NOT EXISTS idx_image_analyses_service_id ON image_analyses(service_id);

-- Index sur media_id pour retrouver l'analyse d'une image
CREATE INDEX IF NOT EXISTS idx_image_analyses_media_id ON image_analyses(media_id);

-- Index sur user_id pour recherches historiques utilisateur
CREATE INDEX IF NOT EXISTS idx_image_analyses_user_id ON image_analyses(user_id);

-- Index sur category_detected pour filtrer par catégorie
CREATE INDEX IF NOT EXISTS idx_image_analyses_category ON image_analyses(category_detected) 
WHERE category_detected IS NOT NULL;

-- Index sur marque pour recherche par marque
CREATE INDEX IF NOT EXISTS idx_image_analyses_marque ON image_analyses(marque) 
WHERE marque IS NOT NULL;

-- Index sur analysis_type pour séparer recherches et catalogages
CREATE INDEX IF NOT EXISTS idx_image_analyses_type ON image_analyses(analysis_type);

-- Index GIN sur tags pour recherche rapide dans les tableaux
CREATE INDEX IF NOT EXISTS idx_image_analyses_tags ON image_analyses USING GIN(tags);

-- Index GIN sur caracteristiques_cles pour recherche dans JSON
CREATE INDEX IF NOT EXISTS idx_image_analyses_caracteristiques 
ON image_analyses USING GIN(caracteristiques_cles);

-- Index full-text sur description (français)
CREATE INDEX IF NOT EXISTS idx_image_analyses_description_fts 
ON image_analyses USING GIN(to_tsvector('french', description));

-- Index full-text sur search_query_semantic
CREATE INDEX IF NOT EXISTS idx_image_analyses_search_semantic_fts 
ON image_analyses USING GIN(to_tsvector('french', COALESCE(search_query_semantic, '')));

-- Index composite pour recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_image_analyses_search_composite 
ON image_analyses(analysis_type, category_detected, marque) 
WHERE analysis_type = 'cataloging';

-- ============================================
-- FONCTIONS UTILITAIRES
-- ============================================

-- Fonction pour calculer le score de matching entre une recherche et un produit catalogué
CREATE OR REPLACE FUNCTION calculate_image_match_score(
    search_tags TEXT[],
    search_marque TEXT,
    search_couleur TEXT,
    search_description TEXT,
    product_tags TEXT[],
    product_marque TEXT,
    product_couleurs TEXT[],
    product_description TEXT
) RETURNS FLOAT AS $$
DECLARE
    score FLOAT := 0.0;
    common_tags INTEGER;
    total_unique_tags INTEGER;
    jaccard_similarity FLOAT;
BEGIN
    -- 1. Score sur tags (Jaccard similarity) - 30%
    SELECT COUNT(DISTINCT tag) INTO common_tags
    FROM unnest(search_tags) tag
    WHERE tag = ANY(product_tags);
    
    SELECT COUNT(DISTINCT tag) INTO total_unique_tags
    FROM (
        SELECT unnest(search_tags) as tag
        UNION
        SELECT unnest(product_tags) as tag
    ) combined;
    
    IF total_unique_tags > 0 THEN
        jaccard_similarity := common_tags::FLOAT / total_unique_tags::FLOAT;
        score := score + (jaccard_similarity * 30.0);
    END IF;
    
    -- 2. Score sur marque exacte - 25%
    IF search_marque IS NOT NULL AND product_marque IS NOT NULL THEN
        IF LOWER(search_marque) = LOWER(product_marque) THEN
            score := score + 25.0;
        ELSIF similarity(LOWER(search_marque), LOWER(product_marque)) > 0.6 THEN
            score := score + (similarity(LOWER(search_marque), LOWER(product_marque)) * 15.0);
        END IF;
    END IF;
    
    -- 3. Score sur couleur principale - 20%
    IF search_couleur IS NOT NULL AND product_couleurs IS NOT NULL THEN
        IF search_couleur = ANY(product_couleurs) THEN
            score := score + 20.0;
        ELSIF EXISTS (
            SELECT 1 FROM unnest(product_couleurs) pc 
            WHERE similarity(LOWER(search_couleur), LOWER(pc)) > 0.7
        ) THEN
            score := score + 12.0;
        END IF;
    END IF;
    
    -- 4. Score sur description (trigram similarity) - 25%
    IF search_description IS NOT NULL AND product_description IS NOT NULL THEN
        score := score + (similarity(
            LOWER(search_description), 
            LOWER(product_description)
        ) * 25.0);
    END IF;
    
    RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ⚠️ NOTE: La fonction hybrid_image_search est créée dans la migration 20250122_create_hybrid_image_search_function.sql
-- Cette migration crée uniquement la table image_analyses et la fonction helper calculate_image_match_score
-- La fonction hybrid_image_search correcte (avec search_query_semantic) sera créée/remplacée par la migration 20250122

-- ============================================
-- TRIGGER pour mettre à jour updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_image_analyses_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_image_analyses_timestamp ON image_analyses;

CREATE TRIGGER trigger_update_image_analyses_timestamp
    BEFORE UPDATE ON image_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_image_analyses_timestamp();

-- ============================================
-- COMMENTAIRES pour documentation
-- ============================================

COMMENT ON TABLE image_analyses IS 'Stocke les analyses IA des images pour recherche hybride et matching intelligent';
COMMENT ON COLUMN image_analyses.description IS 'Description détaillée générée par IA';
COMMENT ON COLUMN image_analyses.tags IS 'Mots-clés extraits de l''image par IA';
COMMENT ON COLUMN image_analyses.category_detected IS 'Catégorie de produit détectée automatiquement';
COMMENT ON COLUMN image_analyses.marque IS 'Marque détectée dans l''image (si visible)';
COMMENT ON COLUMN image_analyses.couleurs IS 'Couleurs principales identifiées';
COMMENT ON COLUMN image_analyses.caracteristiques_cles IS 'Caractéristiques spécifiques extraites (taille, modèle, état, etc.)';
COMMENT ON COLUMN image_analyses.search_query_exact IS 'Requête de recherche exacte (mots-clés précis)';
COMMENT ON COLUMN image_analyses.search_query_broad IS 'Requête de recherche large (avec synonymes)';
COMMENT ON COLUMN image_analyses.search_query_semantic IS 'Description naturelle pour matching sémantique';
COMMENT ON COLUMN image_analyses.analysis_type IS 'Type: search (recherche client) ou cataloging (création produit)';
COMMENT ON COLUMN image_analyses.confiance IS 'Score de confiance de l''analyse IA (0.0-1.0)';
COMMENT ON COLUMN image_analyses.model_used IS 'Modèle IA utilisé (gpt-4-vision, claude-3-opus, etc.)';
COMMENT ON COLUMN image_analyses.tokens_consumed IS 'Nombre de tokens consommés par l''analyse';
COMMENT ON COLUMN image_analyses.cost_usd IS 'Coût de l''analyse en USD';

COMMENT ON FUNCTION calculate_image_match_score IS 'Calcule un score de matching multi-critères entre recherche et produit';
-- NOTE: La fonction hybrid_image_search est définie dans 20250122_create_hybrid_image_search_function.sql


-- Migration: Créer table search_history pour historiser les recherches utilisateurs
-- Date: 2025-10-31
-- Description: Table pour historiser les recherches effectuées par les utilisateurs
--              Permet les suggestions intelligentes et l'amélioration de la recherche
-- Note: Compatible avec SQLx offline mode

-- Vérifier et créer la table search_history
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'search_history') THEN
        CREATE TABLE search_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            -- NULL si recherche anonyme, sinon ID de l'utilisateur
            query_text TEXT NOT NULL,
            -- Texte de la recherche
            query_type VARCHAR(50) DEFAULT 'text',
            -- 'text', 'image', 'voice', 'autocomplete'
            category VARCHAR(255),
            -- Catégorie filtrée (optionnel)
            filters JSONB,
            -- Filtres appliqués (ex: {"prix_min": 10000, "prix_max": 50000, "ville": "Yaoundé"})
            location_lat DOUBLE PRECISION,
            location_lon DOUBLE PRECISION,
            -- Coordonnées GPS si recherche géolocalisée
            results_count INTEGER DEFAULT 0,
            -- Nombre de résultats trouvés
            clicked_result_id INTEGER,
            -- ID du résultat sur lequel l'utilisateur a cliqué (optionnel)
            clicked_at TIMESTAMP WITH TIME ZONE,
            -- Timestamp du clic sur un résultat
            session_id VARCHAR(255),
            -- ID de session pour regrouper les recherches d'une même session
            device_type VARCHAR(50),
            -- 'mobile', 'web', 'tablet'
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE 'Table search_history créée avec succès';
    ELSE
        RAISE NOTICE 'Table search_history existe déjà';
    END IF;
END $$;

-- Index pour recherche par user_id
CREATE INDEX IF NOT EXISTS idx_search_history_user_id 
    ON search_history(user_id) WHERE user_id IS NOT NULL;

-- Index pour recherche par query_text (trigram pour recherche floue)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        -- Utiliser pg_trgm si disponible
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_search_history_query_text_gin 
                 ON search_history USING gin(query_text gin_trgm_ops)';
        RAISE NOTICE 'Index pg_trgm créé pour search_history.query_text';
    ELSE
        -- Index B-tree simple si pg_trgm non disponible
        CREATE INDEX IF NOT EXISTS idx_search_history_query_text_btree 
            ON search_history(query_text);
        RAISE NOTICE 'Index B-tree créé pour search_history.query_text';
    END IF;
END $$;

-- Index pour recherche par query_type
CREATE INDEX IF NOT EXISTS idx_search_history_query_type 
    ON search_history(query_type);

-- Index pour recherche par category
CREATE INDEX IF NOT EXISTS idx_search_history_category 
    ON search_history(category) WHERE category IS NOT NULL;

-- Index pour recherche géolocalisée (si extension PostGIS disponible)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        -- Utiliser PostGIS si disponible
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_search_history_location_gist 
                 ON search_history USING gist(ST_MakePoint(location_lon, location_lat)) 
                 WHERE location_lat IS NOT NULL AND location_lon IS NOT NULL';
        RAISE NOTICE 'Index PostGIS créé pour search_history.location';
    ELSE
        -- Index B-tree simple si PostGIS non disponible
        CREATE INDEX IF NOT EXISTS idx_search_history_location_btree 
            ON search_history(location_lat, location_lon) 
            WHERE location_lat IS NOT NULL AND location_lon IS NOT NULL;
        RAISE NOTICE 'Index B-tree créé pour search_history.location';
    END IF;
END $$;

-- Index pour recherche par session_id
CREATE INDEX IF NOT EXISTS idx_search_history_session_id 
    ON search_history(session_id) WHERE session_id IS NOT NULL;

-- Index pour recherche par created_at (pour statistiques temporelles)
CREATE INDEX IF NOT EXISTS idx_search_history_created_at 
    ON search_history(created_at DESC);

-- Index composite pour recherche utilisateur récente
CREATE INDEX IF NOT EXISTS idx_search_history_user_created 
    ON search_history(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Index pour recherche par clicked_result_id (pour analytics)
CREATE INDEX IF NOT EXISTS idx_search_history_clicked_result 
    ON search_history(clicked_result_id) WHERE clicked_result_id IS NOT NULL;

-- Index GIN pour recherche dans les filtres JSONB
CREATE INDEX IF NOT EXISTS idx_search_history_filters_gin 
    ON search_history USING gin(filters) WHERE filters IS NOT NULL;

-- Fonction pour obtenir les recherches populaires
CREATE OR REPLACE FUNCTION get_popular_searches(
    p_limit INTEGER DEFAULT 10,
    p_category VARCHAR(255) DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    query_text TEXT,
    search_count BIGINT,
    last_searched TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sh.query_text,
        COUNT(*) as search_count,
        MAX(sh.created_at) as last_searched
    FROM search_history sh
    WHERE sh.created_at >= NOW() - (p_days || ' days')::INTERVAL
    AND (p_category IS NULL OR sh.category = p_category)
    GROUP BY sh.query_text
    ORDER BY search_count DESC, last_searched DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les suggestions de recherche pour un utilisateur
CREATE OR REPLACE FUNCTION get_search_suggestions(
    p_user_id INTEGER DEFAULT NULL,
    p_prefix TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    query_text TEXT,
    search_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sh.query_text,
        COUNT(*) as search_count
    FROM search_history sh
    WHERE (p_user_id IS NULL OR sh.user_id = p_user_id)
    AND (p_prefix IS NULL OR LOWER(sh.query_text) LIKE LOWER(p_prefix || '%'))
    AND sh.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY sh.query_text
    ORDER BY 
        CASE WHEN p_user_id IS NOT NULL AND sh.user_id = p_user_id THEN 1 ELSE 2 END,
        search_count DESC,
        MAX(sh.created_at) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour nettoyer les anciennes recherches (à exécuter périodiquement)
CREATE OR REPLACE FUNCTION cleanup_old_search_history(
    p_days_to_keep INTEGER DEFAULT 365
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM search_history
    WHERE created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL
    AND clicked_result_id IS NULL; -- Garder les recherches avec clics plus longtemps
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE search_history IS 'Historique des recherches utilisateurs pour suggestions intelligentes';
COMMENT ON COLUMN search_history.query_text IS 'Texte de la recherche effectuée';
COMMENT ON COLUMN search_history.query_type IS 'Type de recherche: text, image, voice, autocomplete';
COMMENT ON COLUMN search_history.filters IS 'Filtres appliqués au format JSONB';
COMMENT ON COLUMN search_history.results_count IS 'Nombre de résultats trouvés';
COMMENT ON COLUMN search_history.clicked_result_id IS 'ID du résultat sur lequel l''utilisateur a cliqué';
COMMENT ON FUNCTION get_popular_searches IS 'Retourne les recherches les plus populaires';
COMMENT ON FUNCTION get_search_suggestions IS 'Retourne des suggestions de recherche basées sur l''historique';
COMMENT ON FUNCTION cleanup_old_search_history IS 'Nettoie les anciennes recherches (garde celles avec clics)';


-- Migration: Système de tracking de visibilité pour équité publicités/organiques
-- Date: 2025-10-22
-- Description: Table pour tracker les apparitions et garantir l'équité

-- ✅ Table pour tracker les impressions par utilisateur
CREATE TABLE IF NOT EXISTS content_visibility_tracking (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Identifiant du contenu (produit ou publicité)
    content_id VARCHAR(100) NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('organic', 'paid')),
    
    -- Tracking de visibilité
    session_id VARCHAR(100) NOT NULL, -- ID de session utilisateur
    appeared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    position_in_feed INTEGER, -- Position dans le feed (1, 2, 3...)
    
    -- Engagement
    viewed BOOLEAN DEFAULT FALSE, -- Vraiment vu (dans viewport)
    view_duration_ms INTEGER, -- Temps de visionnage en ms
    clicked BOOLEAN DEFAULT FALSE,
    clicked_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ✅ Index pour performances
CREATE INDEX IF NOT EXISTS idx_visibility_user_id ON content_visibility_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_visibility_content ON content_visibility_tracking(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_visibility_session ON content_visibility_tracking(session_id);
CREATE INDEX IF NOT EXISTS idx_visibility_appeared_at ON content_visibility_tracking(appeared_at);

-- ✅ Index composite pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_visibility_user_content ON content_visibility_tracking(user_id, content_id, appeared_at DESC);
CREATE INDEX IF NOT EXISTS idx_visibility_session_content ON content_visibility_tracking(session_id, content_id);

-- ✅ Fonction pour vérifier si un contenu peut apparaître
CREATE OR REPLACE FUNCTION can_show_content(
    p_user_id INTEGER,
    p_content_id VARCHAR(100),
    p_content_type VARCHAR(20),
    p_session_id VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
    last_appearance TIMESTAMPTZ;
    session_count INTEGER;
    recent_positions INTEGER[];
    cooldown_minutes INTEGER;
    max_appearances INTEGER;
BEGIN
    -- Déterminer les limites selon le type
    IF p_content_type = 'organic' THEN
        cooldown_minutes := 60;  -- 1h pour organiques
        max_appearances := 1;    -- 1 fois max par session
    ELSE
        -- Pour publicités, récupérer depuis la table
        SELECT cooldown_minutes, max_appearances_per_session
        INTO cooldown_minutes, max_appearances
        FROM publicites
        WHERE id::TEXT = p_content_id
        LIMIT 1;
        
        -- Valeurs par défaut si non trouvé
        IF cooldown_minutes IS NULL THEN
            cooldown_minutes := 30;
            max_appearances := 3;
        END IF;
    END IF;
    
    -- Vérifier dernière apparition
    SELECT appeared_at INTO last_appearance
    FROM content_visibility_tracking
    WHERE user_id = p_user_id
    AND content_id = p_content_id
    ORDER BY appeared_at DESC
    LIMIT 1;
    
    -- Trop récent ?
    IF last_appearance IS NOT NULL THEN
        IF NOW() - last_appearance < (cooldown_minutes || ' minutes')::INTERVAL THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Quota session atteint ?
    SELECT COUNT(*) INTO session_count
    FROM content_visibility_tracking
    WHERE session_id = p_session_id
    AND content_id = p_content_id;
    
    IF session_count >= max_appearances THEN
        RETURN FALSE;
    END IF;
    
    -- Vérifier dans les 5 dernières positions
    SELECT ARRAY_AGG(position_in_feed ORDER BY appeared_at DESC)
    INTO recent_positions
    FROM (
        SELECT position_in_feed
        FROM content_visibility_tracking
        WHERE user_id = p_user_id
        AND content_id = p_content_id
        ORDER BY appeared_at DESC
        LIMIT 5
    ) recent;
    
    -- Si dans les 5 dernières positions, bloquer
    IF recent_positions IS NOT NULL AND array_length(recent_positions, 1) > 0 THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ✅ Fonction pour obtenir les produits organiques éligibles
CREATE OR REPLACE FUNCTION get_eligible_organic_products(
    p_user_id INTEGER,
    p_session_id VARCHAR(100),
    p_categories TEXT[],
    p_limit INTEGER DEFAULT 15
) RETURNS TABLE (
    product_id TEXT,
    product_data JSONB,
    relevance_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH product_scores AS (
        SELECT 
            s.id::TEXT as pid,
            jsonb_build_object(
                'id', s.id,
                'titre', s.data->>'titre_service',
                'description', s.data->>'description',
                'produits', s.data->'produits',
                'images', s.data->'base64_image',
                'videos', s.data->'video_base64',
                'created_at', s.created_at
            ) as pdata,
            (
                -- Score de pertinence
                CASE WHEN s.data->>'category' = ANY(p_categories) THEN 10 ELSE 0 END +
                CASE WHEN (s.data->>'en_promotion')::BOOLEAN THEN 5 ELSE 0 END +
                CASE WHEN s.created_at > NOW() - INTERVAL '7 days' THEN 3 ELSE 0 END +
                CASE WHEN (s.data->>'rating')::DECIMAL >= 4.0 THEN 2 ELSE 0 END
            )::DECIMAL as score
        FROM services s
        WHERE s.status = 'active'
        -- Vérifier si peut apparaître
        AND can_show_content(p_user_id, s.id::TEXT, 'organic', p_session_id)
    )
    SELECT pid, pdata, score
    FROM product_scores
    ORDER BY score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ✅ Fonction pour obtenir les publicités éligibles
CREATE OR REPLACE FUNCTION get_eligible_paid_ads(
    p_user_id INTEGER,
    p_session_id VARCHAR(100),
    p_categories TEXT[],
    p_boost_level VARCHAR(20) DEFAULT NULL
) RETURNS TABLE (
    pub_id INTEGER,
    pub_data JSONB,
    boost_level VARCHAR(20),
    frequency_ratio INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        jsonb_build_object(
            'id', p.id,
            'titre', p.titre,
            'description', p.description,
            'videos', p.videos,
            'thumbnails', p.thumbnails,
            'boost_level', p.boost_level,
            'produits_indexes', p.produits_indexes
        ) as pdata,
        p.boost_level,
        p.frequency_ratio
    FROM publicites p
    WHERE p.status = 'active'
    AND p.date_fin > NOW()
    -- Vérifier si peut apparaître
    AND can_show_content(p_user_id, p.id::TEXT, 'paid', p_session_id)
    -- Filtrer par niveau si spécifié
    AND (p_boost_level = p_boost_level OR p_boost_level IS NULL)
    ORDER BY 
        -- Priorité: Ultra > Premium > Basic
        CASE p.boost_level
            WHEN 'ultra' THEN 1
            WHEN 'premium' THEN 2
            WHEN 'basic' THEN 3
        END,
        p.vues ASC -- Prioriser celles avec moins de vues
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ✅ Vue matérialisée pour analytics équité
CREATE MATERIALIZED VIEW IF NOT EXISTS visibility_fairness_stats AS
SELECT 
    content_type,
    COUNT(DISTINCT content_id) as unique_items,
    COUNT(*) as total_appearances,
    AVG(view_duration_ms) as avg_view_duration,
    SUM(CASE WHEN clicked THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)::DECIMAL as click_through_rate,
    COUNT(*) / COUNT(DISTINCT content_id) as avg_appearances_per_item
FROM content_visibility_tracking
WHERE appeared_at > NOW() - INTERVAL '7 days'
GROUP BY content_type;

-- ✅ Index sur la vue matérialisée
CREATE UNIQUE INDEX IF NOT EXISTS idx_visibility_fairness_content_type 
    ON visibility_fairness_stats(content_type);

-- ✅ Fonction pour rafraîchir les stats
CREATE OR REPLACE FUNCTION refresh_visibility_stats()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY visibility_fairness_stats;
END;
$$ LANGUAGE plpgsql;

-- ✅ Commentaires pour documentation
COMMENT ON TABLE content_visibility_tracking IS 'Table de tracking pour garantir équité entre contenu organique et payant';
COMMENT ON COLUMN publicites.boost_level IS 'Niveau de boost: basic (500F/j), premium (1500F/j), ultra (3000F/j)';
COMMENT ON COLUMN publicites.max_appearances_per_session IS 'Nombre max d''apparitions par session (basic: 3, premium: 5, ultra: 10)';
COMMENT ON COLUMN publicites.cooldown_minutes IS 'Temps d''attente avant réapparition (basic: 30min, premium: 15min, ultra: 5min)';
COMMENT ON COLUMN publicites.frequency_ratio IS 'Fréquence: 1 toutes les N cartes (basic: 3, premium: 2, ultra: 1)';


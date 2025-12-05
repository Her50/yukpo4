-- Migration: Amélioration algorithme de recommandations avec signaux enrichis
-- Date: 2025-12-03
-- Description: Ajoute colonnes pour temps de visionnage, préférences utilisateur, et signaux contextuels

-- ✅ 1. Ajouter colonnes à content_engagement pour tracking temps de visionnage
ALTER TABLE content_engagement 
ADD COLUMN IF NOT EXISTS watch_duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS video_duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS completion_rate REAL,
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS location_gps VARCHAR(255),
ADD COLUMN IF NOT EXISTS shared BOOLEAN DEFAULT FALSE;

-- Index pour performance sur temps de visionnage
CREATE INDEX IF NOT EXISTS idx_content_engagement_watch_duration 
ON content_engagement(user_id, completion_rate) 
WHERE completion_rate > 0.5;

CREATE INDEX IF NOT EXISTS idx_content_engagement_user_liked 
ON content_engagement(user_id, liked) 
WHERE liked = TRUE;

CREATE INDEX IF NOT EXISTS idx_content_engagement_user_saved 
ON content_engagement(user_id, saved) 
WHERE saved = TRUE;

-- ✅ 2. Créer table user_preferences pour stocker préférences utilisateur
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferred_categories TEXT[] DEFAULT ARRAY[]::TEXT[],
    preferred_hashtags TEXT[] DEFAULT ARRAY[]::TEXT[],
    preferred_creators INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    preferred_video_length_min INTEGER DEFAULT 0,
    preferred_video_length_max INTEGER DEFAULT 600000, -- 10 minutes max par défaut
    avg_watch_duration_ms INTEGER DEFAULT 0,
    most_active_hour INTEGER, -- Heure de la journée la plus active (0-23)
    most_active_day INTEGER,   -- Jour de la semaine le plus actif (0-6, dimanche=0)
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour user_preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_categories 
ON user_preferences USING GIN(preferred_categories);

CREATE INDEX IF NOT EXISTS idx_user_preferences_hashtags 
ON user_preferences USING GIN(preferred_hashtags);

-- ✅ 3. Fonction pour calculer/mettre à jour préférences utilisateur
CREATE OR REPLACE FUNCTION update_user_preferences(p_user_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_categories TEXT[];
    v_hashtags TEXT[];
    v_creators INTEGER[];
    v_avg_watch_duration INTEGER;
    v_most_active_hour INTEGER;
    v_most_active_day INTEGER;
BEGIN
    -- Calculer catégories préférées (depuis services likés)
    SELECT array_agg(DISTINCT s.category)
    INTO v_categories
    FROM content_engagement ce
    JOIN media m ON m.id::text = ce.content_id OR 'media_' || m.service_id || '_' || m.id = ce.content_id
    JOIN services s ON s.id = m.service_id
    WHERE ce.user_id = p_user_id
      AND ce.liked = TRUE
      AND ce.created_at > NOW() - INTERVAL '90 days'
      AND s.category IS NOT NULL;
    
    -- Calculer hashtags préférés (depuis vidéos likées)
    SELECT array_agg(DISTINCT tag)
    INTO v_hashtags
    FROM content_engagement ce
    JOIN media m ON m.id::text = ce.content_id OR 'media_' || m.service_id || '_' || m.id = ce.content_id
    CROSS JOIN LATERAL unnest(COALESCE(m.ai_tags, ARRAY[]::TEXT[])) tag
    WHERE ce.user_id = p_user_id
      AND ce.liked = TRUE
      AND ce.created_at > NOW() - INTERVAL '90 days';
    
    -- Calculer créateurs préférés (depuis services likés)
    SELECT array_agg(DISTINCT s.user_id)
    INTO v_creators
    FROM content_engagement ce
    JOIN media m ON m.id::text = ce.content_id OR 'media_' || m.service_id || '_' || m.id = ce.content_id
    JOIN services s ON s.id = m.service_id
    WHERE ce.user_id = p_user_id
      AND ce.liked = TRUE
      AND ce.created_at > NOW() - INTERVAL '90 days';
    
    -- Calculer durée moyenne de visionnage
    SELECT COALESCE(AVG(watch_duration_ms), 0)::INTEGER
    INTO v_avg_watch_duration
    FROM content_engagement
    WHERE user_id = p_user_id
      AND watch_duration_ms IS NOT NULL
      AND created_at > NOW() - INTERVAL '30 days';
    
    -- Calculer heure la plus active
    SELECT EXTRACT(HOUR FROM created_at)::INTEGER
    INTO v_most_active_hour
    FROM content_engagement
    WHERE user_id = p_user_id
      AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY EXTRACT(HOUR FROM created_at)
    ORDER BY COUNT(*) DESC
    LIMIT 1;
    
    -- Calculer jour le plus actif
    SELECT EXTRACT(DOW FROM created_at)::INTEGER
    INTO v_most_active_day
    FROM content_engagement
    WHERE user_id = p_user_id
      AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY EXTRACT(DOW FROM created_at)
    ORDER BY COUNT(*) DESC
    LIMIT 1;
    
    -- Insérer ou mettre à jour préférences
    INSERT INTO user_preferences (
        user_id, 
        preferred_categories, 
        preferred_hashtags, 
        preferred_creators,
        avg_watch_duration_ms,
        most_active_hour,
        most_active_day,
        last_updated
    )
    VALUES (
        p_user_id,
        COALESCE(v_categories, ARRAY[]::TEXT[]),
        COALESCE(v_hashtags, ARRAY[]::TEXT[]),
        COALESCE(v_creators, ARRAY[]::INTEGER[]),
        COALESCE(v_avg_watch_duration, 0),
        v_most_active_hour,
        v_most_active_day,
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        preferred_categories = EXCLUDED.preferred_categories,
        preferred_hashtags = EXCLUDED.preferred_hashtags,
        preferred_creators = EXCLUDED.preferred_creators,
        avg_watch_duration_ms = EXCLUDED.avg_watch_duration_ms,
        most_active_hour = EXCLUDED.most_active_hour,
        most_active_day = EXCLUDED.most_active_day,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- ✅ 4. Trigger pour mettre à jour completion_rate automatiquement
CREATE OR REPLACE FUNCTION calculate_completion_rate()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.watch_duration_ms IS NOT NULL AND NEW.video_duration_ms IS NOT NULL AND NEW.video_duration_ms > 0 THEN
        NEW.completion_rate = LEAST(
            (NEW.watch_duration_ms::REAL / NEW.video_duration_ms::REAL),
            1.0
        );
    ELSE
        NEW.completion_rate = 0.0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_completion_rate ON content_engagement;
CREATE TRIGGER trg_calculate_completion_rate
    BEFORE INSERT OR UPDATE OF watch_duration_ms, video_duration_ms ON content_engagement
    FOR EACH ROW
    EXECUTE FUNCTION calculate_completion_rate();

-- ✅ 5. Vue pour statistiques vidéo enrichies (pour scoring)
CREATE OR REPLACE VIEW video_engagement_stats AS
SELECT 
    content_id,
    COUNT(*) as total_views,
    SUM(CASE WHEN liked = TRUE THEN 1 ELSE 0 END) as total_likes,
    SUM(CASE WHEN saved = TRUE THEN 1 ELSE 0 END) as total_saves,
    SUM(CASE WHEN shared = TRUE THEN 1 ELSE 0 END) as total_shares,
    AVG(completion_rate) as avg_completion_rate,
    AVG(watch_duration_ms) as avg_watch_duration_ms,
    MAX(created_at) as last_engagement_at
FROM content_engagement
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY content_id;

-- Commentaires
COMMENT ON TABLE user_preferences IS 'Préférences utilisateur calculées depuis historique d''engagement';
COMMENT ON COLUMN content_engagement.watch_duration_ms IS 'Durée de visionnage en millisecondes';
COMMENT ON COLUMN content_engagement.completion_rate IS 'Taux de complétion (0.0 à 1.0)';
COMMENT ON COLUMN user_preferences.preferred_categories IS 'Catégories préférées calculées depuis historique';
COMMENT ON COLUMN user_preferences.avg_watch_duration_ms IS 'Durée moyenne de visionnage de l''utilisateur';


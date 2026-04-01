-- 📊 Tables pour analytics vidéo avancé
-- Tracking temps réel, heatmaps, performance créateurs

-- Événements analytics détaillés
CREATE TABLE IF NOT EXISTS video_analytics_events (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255) NOT NULL,  -- Session unique par utilisateur/device
    
    -- Type d'événement
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN (
        'play', 'pause', 'seek', 'complete', 'skip', 
        'quality_change', 'buffer_start', 'buffer_end', 'error'
    )),
    
    -- Timestamp et position
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    position_seconds DECIMAL(10,2) NOT NULL,  -- Position dans la vidéo
    duration_seconds DECIMAL(10,2) NOT NULL,  -- Durée totale de la vidéo
    
    -- Device et qualité
    device_info JSONB,  -- {platform, app_version, connection_type, network_quality}
    quality VARCHAR(10),  -- "1080p", "720p", "480p", "360p", "auto"
    
    -- Index pour performance
    CONSTRAINT video_analytics_events_check CHECK (video_id > 0)
);

-- Index pour requêtes analytics
CREATE INDEX IF NOT EXISTS idx_video_analytics_events_video_id ON video_analytics_events(video_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_events_timestamp ON video_analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_video_analytics_events_user_id ON video_analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_events_session_id ON video_analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_events_type ON video_analytics_events(event_type);

-- Index composite pour requêtes complexes
CREATE INDEX IF NOT EXISTS idx_video_analytics_events_video_timestamp ON video_analytics_events(video_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_video_analytics_events_video_type ON video_analytics_events(video_id, event_type);

-- Agrégats temps réel pour dashboard créateurs
CREATE TABLE IF NOT EXISTS video_analytics_realtime (
    video_id INTEGER PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_views BIGINT NOT NULL DEFAULT 0,
    avg_watch_time DECIMAL(10,2) NOT NULL DEFAULT 0,
    unique_viewers_today INTEGER NOT NULL DEFAULT 0,
    completion_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    engagement_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- Cache des dernières 24h
    views_today BIGINT NOT NULL DEFAULT 0,
    shares_today BIGINT NOT NULL DEFAULT 0,
    comments_today BIGINT NOT NULL DEFAULT 0,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_analytics_realtime_updated ON video_analytics_realtime(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_video_analytics_realtime_score ON video_analytics_realtime(engagement_score DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_video_analytics_realtime_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER video_analytics_realtime_updated_at_trigger
    BEFORE UPDATE ON video_analytics_realtime
    FOR EACH ROW
    EXECUTE FUNCTION update_video_analytics_realtime_updated_at();

-- Vue pour les analytics vidéo complets
CREATE OR REPLACE VIEW video_analytics_summary AS
SELECT 
    e.video_id,
    COUNT(*) FILTER (WHERE e.event_type = 'play') as total_views,
    COUNT(DISTINCT e.user_id) as unique_viewers,
    COUNT(DISTINCT e.session_id) as unique_sessions,
    AVG(e.position_seconds) FILTER (WHERE e.event_type = 'play') as avg_watch_time,
    
    -- Taux de complétion
    (SELECT COUNT(*) FROM video_analytics_events e2 
     WHERE e2.video_id = e.video_id AND e2.event_type = 'complete')::decimal / 
    NULLIF(COUNT(*) FILTER (WHERE e.event_type = 'play'), 0) * 100 as completion_rate,
    
    -- Taux de skip
    (SELECT COUNT(*) FROM video_analytics_events e3 
     WHERE e3.video_id = e.video_id AND e3.event_type = 'skip')::decimal / 
    NULLIF(COUNT(*) FILTER (WHERE e.event_type = 'play'), 0) * 100 as skip_rate,
    
    -- Performance
    AVG(CASE WHEN e.event_type = 'buffer_start' THEN 
        EXTRACT(EPOCH FROM (
            (SELECT timestamp FROM video_analytics_events e4 
             WHERE e4.video_id = e.video_id AND e4.session_id = e.session_id 
             AND e4.event_type = 'buffer_end' AND e4.timestamp > e.timestamp
             ORDER BY e4.timestamp LIMIT 1) - e.timestamp
        )
    END) as avg_buffer_time_ms,
    
    MAX(e.timestamp) as last_activity,
    m.path as video_path,
    s.user_id as creator_id,
    s.category
FROM video_analytics_events e
JOIN media m ON m.id = e.video_id
JOIN services s ON s.id = m.service_id
GROUP BY e.video_id, m.path, s.user_id, s.category;

-- Vue pour les analytics créateurs
CREATE OR REPLACE VIEW creator_analytics_summary AS
SELECT 
    s.user_id as creator_id,
    COALESCE(u.nom_complet, CONCAT(u.prenom, ' ', u.nom), u.email) as creator_name,
    COUNT(DISTINCT m.id) as total_videos,
    COALESCE(SUM(avs.total_views), 0) as total_views,
    COALESCE(SUM(avs.unique_viewers), 0) as total_unique_viewers,
    COALESCE(AVG(avs.avg_watch_time), 0) as avg_watch_time_per_video,
    COALESCE(AVG(avs.completion_rate), 0) as avg_completion_rate,
    COALESCE(AVG(avs.engagement_score), 0) as avg_engagement_score,
    
    -- Top vidéo
    (SELECT video_id FROM video_analytics_realtime 
     WHERE video_id IN (SELECT m.id FROM media m JOIN services s2 ON s2.id = m.service_id WHERE s2.user_id = s.user_id)
     ORDER BY engagement_score DESC LIMIT 1) as top_video_id,
    
    -- Performance des 7 derniers jours
    (SELECT COALESCE(SUM(total_views), 0) FROM video_analytics_realtime 
     WHERE video_id IN (SELECT m.id FROM media m JOIN services s2 ON s2.id = m.service_id WHERE s2.user_id = s.user_id)
     AND last_updated >= NOW() - INTERVAL '7 days') as views_last_7_days,
     
    MAX(avs.last_activity) as last_video_activity
FROM services s
JOIN users u ON u.id = s.user_id
LEFT JOIN media m ON m.service_id = s.id AND m.type = 'video'
LEFT JOIN video_analytics_summary avs ON avs.video_id = m.id
WHERE s.is_active = true
GROUP BY s.user_id, COALESCE(u.nom_complet, CONCAT(u.prenom, ' ', u.nom), u.email);

-- Partitionnement mensuel pour les événements (optionnel pour gros volumes)
-- CREATE TABLE video_analytics_events_y2026m03 PARTITION OF video_analytics_events
-- FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Commentaires sur les tables
COMMENT ON TABLE video_analytics_events IS 'Événements détaillés pour analytics vidéo (play, pause, seek, etc.)';
COMMENT ON COLUMN video_analytics_events.session_id IS 'Session unique par utilisateur/device pour tracking';
COMMENT ON COLUMN video_analytics_events.position_seconds IS 'Position dans la vidéo en secondes au moment de l événement';
COMMENT ON COLUMN video_analytics_events.device_info IS 'JSON avec platform, app_version, connection_type, network_quality';
COMMENT ON TABLE video_analytics_realtime IS 'Agrégats temps réel pour dashboard créateurs';
COMMENT ON VIEW video_analytics_summary IS 'Vue synthétique des analytics par vidéo';
COMMENT ON VIEW creator_analytics_summary IS 'Vue synthétique des analytics par créateur';

-- Fonction pour nettoyer les anciens événements (rétention 90 jours)
CREATE OR REPLACE FUNCTION cleanup_old_video_analytics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM video_analytics_events 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

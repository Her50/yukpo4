-- ✅ Migrations pour la scalabilité (millions de créations vidéo simultanées)

-- ✅ Index optimisés pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_video_jobs_status_created 
    ON video_generation_jobs(status, created_at) 
    WHERE status IN ('queued', 'processing');

CREATE INDEX IF NOT EXISTS idx_video_jobs_user_status 
    ON video_generation_jobs(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_studio_sessions_user_updated 
    ON studio_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_studio_sessions_status 
    ON studio_sessions(status, created_at DESC) 
    WHERE status != 'draft';

-- ✅ Index partiel pour les jobs actifs uniquement (sans condition NOW() car non IMMUTABLE)
-- Note: Cet index couvre tous les jobs queued/processing, la condition de date sera gérée dans la requête
CREATE INDEX IF NOT EXISTS idx_video_jobs_active 
    ON video_generation_jobs(created_at DESC) 
    WHERE status IN ('queued', 'processing');

-- ✅ Table pour le tracking des métriques en temps réel (partitionnée)
CREATE TABLE IF NOT EXISTS video_generation_metrics (
    id BIGSERIAL,
    job_id UUID NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    duration_ms BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ✅ Partitions mensuelles pour les métriques
CREATE TABLE IF NOT EXISTS video_generation_metrics_2025_01 
    PARTITION OF video_generation_metrics
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS video_generation_metrics_2025_02 
    PARTITION OF video_generation_metrics
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- ✅ Index sur les métriques
CREATE INDEX IF NOT EXISTS idx_video_metrics_job 
    ON video_generation_metrics(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_metrics_user 
    ON video_generation_metrics(user_id, created_at DESC);

-- ✅ Table pour le rate limiting (si pas de Redis)
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_user_endpoint 
    ON rate_limit_tracking(user_id, endpoint, window_start DESC);

-- ✅ Nettoyage automatique des anciennes entrées de rate limiting
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit_tracking 
    WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ✅ Optimisation des requêtes avec matérielisation pour les stats
CREATE MATERIALIZED VIEW IF NOT EXISTS video_generation_stats_hourly AS
SELECT 
    DATE_TRUNC('hour', created_at) AS hour,
    status,
    COUNT(*) AS job_count,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) AS avg_duration_seconds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))) AS median_duration_seconds,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))) AS p95_duration_seconds
FROM video_generation_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at), status;

CREATE UNIQUE INDEX IF NOT EXISTS idx_video_stats_hourly 
    ON video_generation_stats_hourly(hour, status);

-- ✅ Rafraîchissement automatique de la vue matérialisée
CREATE OR REPLACE FUNCTION refresh_video_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY video_generation_stats_hourly;
END;
$$ LANGUAGE plpgsql;

-- ✅ Optimisation de la table studio_preview_events (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_preview_events') THEN
        CREATE INDEX IF NOT EXISTS idx_preview_events_session_created 
        ON studio_preview_events(session_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_preview_events_status 
        ON studio_preview_events(status, created_at DESC) 
        WHERE status IN ('processing', 'completed');
    END IF;
END $$;

-- ✅ Table pour le cache des sessions (fallback si Redis indisponible)
CREATE TABLE IF NOT EXISTS studio_session_cache (
    session_id UUID PRIMARY KEY,
    cached_data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ✅ Index sur expires_at (sans condition NOW() car non IMMUTABLE)
-- La condition de date sera gérée dans les requêtes
CREATE INDEX IF NOT EXISTS idx_session_cache_expires 
    ON studio_session_cache(expires_at);

-- ✅ Nettoyage automatique du cache expiré
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM studio_session_cache 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ✅ Optimisation des connexions avec connection pooling hints
COMMENT ON TABLE video_generation_jobs IS 
    'Jobs de génération vidéo - Optimisé pour millions de requêtes simultanées. Utiliser FOR UPDATE SKIP LOCKED pour le processing.';

COMMENT ON TABLE studio_sessions IS 
    'Sessions de création vidéo - Index optimisés pour les requêtes par user_id et status.';

-- ✅ Statistiques mises à jour automatiquement (protégé)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'video_generation_jobs') THEN
        ANALYZE video_generation_jobs;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_sessions') THEN
        ANALYZE studio_sessions;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_timeline_clips') THEN
        ANALYZE studio_timeline_clips;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_preview_events') THEN
        ANALYZE studio_preview_events;
    END IF;
END $$;


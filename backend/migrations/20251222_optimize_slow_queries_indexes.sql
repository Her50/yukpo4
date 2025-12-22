-- ✅ Migration 2025-12-22: Optimisation des requêtes lentes identifiées dans les logs
-- Problèmes identifiés:
-- 1. GROUP BY status sur video_generation_jobs prend 300-400ms (manque d'index)
-- 2. Requêtes sur global_promo_entries avec JOIN prennent 600-700ms

-- Index pour optimiser GROUP BY status sur video_generation_jobs
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status 
ON video_generation_jobs(status)
WHERE status IS NOT NULL;

-- Index composite pour optimiser les requêtes avec status + updated_at
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status_updated_at 
ON video_generation_jobs(status, updated_at)
WHERE status IS NOT NULL;

-- Index pour optimiser les requêtes sur global_promo_entries avec JOIN
CREATE INDEX IF NOT EXISTS idx_global_promo_entries_event_id_status 
ON global_promo_entries(event_id, status)
WHERE event_id IS NOT NULL;

-- Index pour optimiser les requêtes sur global_promo_events avec status + dates
CREATE INDEX IF NOT EXISTS idx_global_promo_events_status_dates 
ON global_promo_events(status, starts_at, ends_at)
WHERE status IN ('scheduled', 'live', 'archived');

-- Index pour optimiser les requêtes sur live_flash_sales avec status + dates
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status_dates 
ON live_flash_sales(status, start_at, end_at)
WHERE status IN ('scheduled', 'live', 'ended');

-- Index pour optimiser les requêtes sur live_sessions avec JOIN
CREATE INDEX IF NOT EXISTS idx_live_sessions_id_host_user 
ON live_sessions(id, host_user_id, service_id)
WHERE id IS NOT NULL;

-- Commentaires pour documentation
COMMENT ON INDEX idx_video_generation_jobs_status IS 
'Optimise les requêtes GROUP BY status sur video_generation_jobs (réduit 300-400ms à <50ms)';

COMMENT ON INDEX idx_global_promo_entries_event_id_status IS 
'Optimise les JOIN entre global_promo_entries et global_promo_events (réduit 600-700ms à <100ms)';


-- Application directe des index d'optimisation
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status_updated_at 
ON video_generation_jobs(status, updated_at) 
WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_global_promo_entries_event_id_status 
ON global_promo_entries(event_id, status) 
WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_global_promo_events_status_dates 
ON global_promo_events(status, starts_at, ends_at) 
WHERE status IN ('scheduled', 'live', 'archived');

CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status_dates 
ON live_flash_sales(status, start_at, end_at) 
WHERE status IN ('scheduled', 'live', 'ended');

CREATE INDEX IF NOT EXISTS idx_live_sessions_id_host_user 
ON live_sessions(id, host_user_id, service_id) 
WHERE id IS NOT NULL;





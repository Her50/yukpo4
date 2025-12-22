# Application directe des index d'optimisation
$env:DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

Write-Host "🔧 Application des index d'optimisation..." -ForegroundColor Yellow

$index1 = "CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status_updated_at ON video_generation_jobs(status, updated_at) WHERE status IS NOT NULL"
$index2 = "CREATE INDEX IF NOT EXISTS idx_global_promo_entries_event_id_status ON global_promo_entries(event_id, status) WHERE event_id IS NOT NULL"
$index3 = "CREATE INDEX IF NOT EXISTS idx_global_promo_events_status_dates ON global_promo_events(status, starts_at, ends_at) WHERE status IN ('scheduled', 'live', 'archived')"
$index4 = "CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status_dates ON live_flash_sales(status, start_at, end_at) WHERE status IN ('scheduled', 'live', 'ended')"
$index5 = "CREATE INDEX IF NOT EXISTS idx_live_sessions_id_host_user ON live_sessions(id, host_user_id, service_id) WHERE id IS NOT NULL"

Write-Host "📊 Création des index..." -ForegroundColor Cyan
sqlx query --database-url $env:DATABASE_URL $index1
sqlx query --database-url $env:DATABASE_URL $index2
sqlx query --database-url $env:DATABASE_URL $index3
sqlx query --database-url $env:DATABASE_URL $index4
sqlx query --database-url $env:DATABASE_URL $index5

Write-Host "✨ Terminé!" -ForegroundColor Green


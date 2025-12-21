# Script simple pour exécuter la migration PostgreSQL
$env:PGPASSWORD = "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"
$DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db?sslmode=require"
$MIGRATION_FILE = "backend\migrations\20251221_optimize_slow_endpoints.sql"

Write-Host "Exécution de la migration PostgreSQL..." -ForegroundColor Green
Get-Content $MIGRATION_FILE | psql $DATABASE_URL

Write-Host "`nMigration PostgreSQL terminée!" -ForegroundColor Green


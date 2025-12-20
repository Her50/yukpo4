# Script pour exécuter la migration 20251210_fix_u_client_name_error.sql
# et vérifier qu'elle est bien enregistrée dans _sqlx_migrations

$DatabaseUrl = "postgresql://user:password@host:port/database"

Write-Host "=== Execution de la migration 20251210_fix_u_client_name_error.sql ===" -ForegroundColor Cyan
Write-Host ""

# Vérifier psql
try {
    $psqlPath = (Get-Command psql -ErrorAction Stop).Source
    Write-Host "[OK] psql trouve: $psqlPath" -ForegroundColor Green
}
catch {
    Write-Host "[ERREUR] psql non trouve. Installez PostgreSQL." -ForegroundColor Red
    exit 1
}

# Vérifier si la migration existe déjà dans _sqlx_migrations
Write-Host "[VERIF] Verification si la migration est deja appliquee..." -ForegroundColor Yellow
$env:PGPASSWORD = "YOUR_PASSWORD"
$checkMigration = & $psqlPath -h "your-render-db-host.render.com" -p 5432 -U "yukpo_db_user" -d "yukpo_db" -t -A -c "SELECT COUNT(*) FROM _sqlx_migrations WHERE version = 20251210000000;" 2>&1

if ($LASTEXITCODE -eq 0 -and $checkMigration.Trim() -eq "1") {
    Write-Host "[INFO] Migration deja appliquee (version 20251210000000)" -ForegroundColor Yellow
    Write-Host "[INFO] Re-execution de la migration pour verification..." -ForegroundColor Yellow
}
else {
    Write-Host "[INFO] Migration non trouvee dans _sqlx_migrations" -ForegroundColor Yellow
    Write-Host "[INFO] Execution de la migration..." -ForegroundColor Yellow
}

# Exécuter la migration
Write-Host ""
Write-Host "[EXEC] Execution de la migration..." -ForegroundColor Yellow

$migrationFile = "backend/migrations/20251210_fix_u_client_name_error.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "[ERREUR] Fichier de migration non trouve: $migrationFile" -ForegroundColor Red
    exit 1
}

$result = & $psqlPath -h "your-render-db-host.render.com" -p 5432 -U "yukpo_db_user" -d "yukpo_db" -f $migrationFile 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Migration executee avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Resultat:" -ForegroundColor Cyan
    $result | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
}
else {
    Write-Host "[ERREUR] Echec de l'execution de la migration" -ForegroundColor Red
    Write-Host "Code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "Details:" -ForegroundColor Red
    $result | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    exit 1
}

# Vérifier que la migration est enregistrée dans _sqlx_migrations
Write-Host ""
Write-Host "[VERIF] Verification dans _sqlx_migrations..." -ForegroundColor Yellow

# Note: SQLx utilise un format de version spécifique. Vérifions les migrations récentes
$recentMigrations = & $psqlPath -h "your-render-db-host.render.com" -p 5432 -U "yukpo_db_user" -d "yukpo_db" -c "SELECT version, description, installed_on, success FROM _sqlx_migrations WHERE description ILIKE '%u_client%' OR description ILIKE '%fix%' ORDER BY installed_on DESC LIMIT 5;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Migrations trouvees:" -ForegroundColor Green
    $recentMigrations | Select-Object -Skip 2 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
}
else {
    Write-Host "[INFO] Aucune migration correspondante trouvee (normal si executee manuellement)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Migration terminee ===" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Cette migration est deja integree dans auto_migrate.rs" -ForegroundColor Cyan
Write-Host "      Elle sera executee automatiquement au demarrage de l'application" -ForegroundColor Cyan


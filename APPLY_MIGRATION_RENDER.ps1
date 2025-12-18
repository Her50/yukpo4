# Script pour appliquer la migration d'optimisation directement sur Render
# Date: 2025-12-17

$env:PGPASSWORD = "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"
$env:PGHOST = "dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com"
$env:PGPORT = "5432"
$env:PGUSER = "yukpo_db_user"
$env:PGDATABASE = "yukpo_db"

$migrationFile = "backend\migrations\20251217_optimize_search_performance.sql"

Write-Host "=== Application de la migration d'optimisation de recherche ===" -ForegroundColor Cyan
Write-Host "Base de donnees: Render PostgreSQL" -ForegroundColor Green

if (-not (Test-Path $migrationFile)) {
    Write-Host "ERREUR: Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "Fichier trouve: $migrationFile" -ForegroundColor Green
Write-Host "`nApplication de la migration..." -ForegroundColor Yellow
Write-Host "Cette operation peut prendre plusieurs minutes (creation d'index CONCURRENTLY)..." -ForegroundColor Yellow
Write-Host ""

# Appliquer la migration
Get-Content $migrationFile -Raw | psql --set=sslmode=require

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== Migration appliquee avec succes! ===" -ForegroundColor Green
    Write-Host "Les index GIN ont ete crees pour ameliorer les performances de recherche." -ForegroundColor Cyan
    Write-Host "Gain estime: 60-70% de reduction du temps de reponse (5.1s -> ~1.5s)" -ForegroundColor Cyan
} else {
    Write-Host "`n=== Erreur lors de l'application de la migration ===" -ForegroundColor Red
    Write-Host "Code de sortie: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

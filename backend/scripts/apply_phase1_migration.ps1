# Script pour appliquer la migration Phase 1 directement
# Utilise les credentials Render fournis

$env:DATABASE_URL = "postgresql://user:password@host:port/database"

Write-Host "🔍 Application de la migration Phase 1 (optimisations livraison)..." -ForegroundColor Cyan

# Lire le fichier SQL
$migrationPath = "migrations/20250127_phase1_delivery_optimizations.sql"
$sqlContent = Get-Content -Path $migrationPath -Raw

# Appliquer via psql
$sqlContent | psql $env:DATABASE_URL

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration Phase 1 appliquée avec succès!" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
    exit 1
}


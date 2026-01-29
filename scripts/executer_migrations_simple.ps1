# Script PowerShell simple pour exécuter les migrations manquantes
# Utilise les fichiers de migration existants directement

$ErrorActionPreference = "Stop"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Execution Simple des Migrations Manquantes" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# Liste des migrations à exécuter dans l'ordre
$migrations = @(
    "backend/migrations/20260102_create_product_creation_queue.sql",
    "backend/migrations/20251111001_002_create_live_flash_sales.sql",
    "backend/migrations/20251115002_create_global_promo_platform.sql",
    "backend/migrations/20251115001_create_delivery_matching_tables.sql",
    "backend/migrations/20250120_001_add_order_preparation_system.sql"
)

Write-Host "Migrations a executer:" -ForegroundColor Yellow
foreach ($migration in $migrations) {
    if (Test-Path $migration) {
        Write-Host "  OK: $migration" -ForegroundColor Green
    } else {
        Write-Host "  MANQUANT: $migration" -ForegroundColor Red
    }
}
Write-Host ""

# Créer un script SQL combiné
$combinedSQL = @"
-- ============================================================================
-- Migration manuelle combinée pour créer les tables manquantes
-- Généré le $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- ============================================================================

"@

foreach ($migration in $migrations) {
    if (Test-Path $migration) {
        Write-Host "Ajout de $migration..." -ForegroundColor Yellow
        $content = Get-Content $migration -Raw
        $combinedSQL += "-- ============================================================================`n"
        $combinedSQL += "-- Migration: $migration`n"
        $combinedSQL += "-- ============================================================================`n"
        $combinedSQL += $content
        $combinedSQL += "`n`n"
    }
}

# Sauvegarder le script combiné
$outputFile = "combined_migrations_$(Get-Date -Format 'yyyyMMddHHmmss').sql"
$combinedSQL | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host ""
Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Script SQL combine cree: $outputFile" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""
Write-Host "INSTRUCTIONS POUR EXECUTER:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Depuis un serveur accessible a la base de donnees AWS RDS:" -ForegroundColor White
Write-Host "   psql `$DATABASE_URL -f $outputFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Depuis un conteneur ECS (via AWS CLI):" -ForegroundColor White
Write-Host "   aws ecs execute-command --cluster yukpomnang-cluster --task <TASK_ID> --container backend --interactive --command `"psql `$DATABASE_URL -f /app/$outputFile`"" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Depuis GitHub Actions ou CI/CD:" -ForegroundColor White
Write-Host "   - Uploader le fichier $outputFile dans votre pipeline" -ForegroundColor Cyan
Write-Host "   - L'executer avec psql dans votre job" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Alternative: Utiliser sqlx migrate run (recommandé)" -ForegroundColor White
Write-Host "   sqlx migrate run --database-url `$DATABASE_URL" -ForegroundColor Cyan
Write-Host ""


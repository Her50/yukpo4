# Script automatique pour appliquer le script SQL de correction
# Recupere DATABASE_URL depuis SSM et execute toutes les corrections automatiquement

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$Region = "us-east-1",
    [string]$ScriptPath = "backend/migrations/20260207_fix_all_missing_tables_and_functions.sql",
    [string]$SsmParameterPath = "/yukpomnang/production/DATABASE_URL"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Application Automatique du Script SQL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Recuperer DATABASE_URL depuis SSM
Write-Host "Recuperation de DATABASE_URL depuis SSM Parameter Store..." -ForegroundColor Yellow
$databaseUrl = aws ssm get-parameter --name $SsmParameterPath --region $Region --with-decryption --query Parameter.Value --output text 2>&1

if ($LASTEXITCODE -ne 0 -or -not $databaseUrl -or $databaseUrl -match "error") {
    Write-Host "ERREUR: Impossible de recuperer DATABASE_URL depuis SSM" -ForegroundColor Red
    Write-Host "   Verifiez que le parametre existe: $SsmParameterPath" -ForegroundColor Yellow
    exit 1
}

$databaseUrl = $databaseUrl.Trim()
Write-Host "✅ DATABASE_URL recuperee depuis SSM" -ForegroundColor Green
Write-Host ""

# Executer le script divise
Write-Host "Execution du script SQL divise..." -ForegroundColor Yellow
Write-Host ""

& "$PSScriptRoot\executer_sql_divise_postgres_container.ps1" `
    -ClusterName $ClusterName `
    -Region $Region `
    -DatabaseUrl $databaseUrl `
    -ScriptPath $ScriptPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ Script SQL applique avec succes!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Toutes les corrections ont ete appliquees:" -ForegroundColor Cyan
    Write-Host "  - Table user_saved_addresses creee" -ForegroundColor Gray
    Write-Host "  - Fonctions calculate_best_vector_match_score et product_combination_exists creees" -ForegroundColor Gray
    Write-Host "  - Index unique pour services_search_optimized_v2 corrige" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Pour verifier les resultats:" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File backend/scripts/verifier_corrections_sql.ps1" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "❌ Erreur lors de l'application du script SQL" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}




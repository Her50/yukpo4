# Script pour appliquer la migration via gcloud sql connect avec pipe
# Usage: .\scripts\apply_migration_via_gcloud.ps1

$sqlFile = "scripts\apply_delivery_proximity_migration_simple.sql"
$instanceName = "yukpo-postgres"
$databaseName = "yukpo_db"
$user = "yukpo_user"
$projectId = "yukpo-project"

Write-Host "Application de la migration via gcloud sql connect..." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $sqlFile)) {
    Write-Host "Erreur: Fichier non trouve: $sqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "Cette methode utilise gcloud sql connect qui necessite une authentification interactive." -ForegroundColor Yellow
Write-Host ""
Write-Host "Pour appliquer automatiquement, utilisez plutot:" -ForegroundColor Cyan
Write-Host "  1. La console Cloud SQL (recommandee - sans mot de passe)" -ForegroundColor White
Write-Host "  2. psql avec mot de passe: .\scripts\apply_migration_final.ps1 -Password 'MOT_DE_PASSE'" -ForegroundColor White
Write-Host ""

# Créer un script temporaire qui sera exécuté via gcloud sql connect
$tempScript = [System.IO.Path]::GetTempFileName() + ".sql"
Get-Content $sqlFile -Raw -Encoding UTF8 | Out-File -FilePath $tempScript -Encoding UTF8 -NoNewline

Write-Host "Script SQL temporaire cree: $tempScript" -ForegroundColor Gray
Write-Host ""
Write-Host "Pour executer manuellement:" -ForegroundColor Yellow
Write-Host "  gcloud sql connect $instanceName --user=$user --database=$databaseName --project=$projectId" -ForegroundColor White
Write-Host "  Puis dans psql: \i $tempScript" -ForegroundColor White
Write-Host ""

Write-Host "OU copiez-collez le contenu de: $sqlFile" -ForegroundColor Cyan



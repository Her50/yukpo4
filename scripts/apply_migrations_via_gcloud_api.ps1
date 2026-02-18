# Script pour appliquer les migrations via gcloud sql execute-sql

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db"
)

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Application des Migrations d'Optimisation SQL via gcloud API" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Lire les migrations
$migrations = @(
    "backend\migrations\20260218_optimize_delivery_matching_queue_final.sql",
    "backend\migrations\20260218_optimize_delivery_proximity_suggestions.sql",
    "backend\migrations\20260218_optimize_product_orders_validation_deadline.sql"
)

$allSql = ""

foreach ($migration in $migrations) {
    if (Test-Path $migration) {
        Write-Host "Lecture: $migration" -ForegroundColor Green
        $content = Get-Content $migration -Raw
        $allSql += $content + "`n`n"
    }
}

# Créer un fichier temporaire
$tempFile = [System.IO.Path]::GetTempFileName()
$tempFile = $tempFile -replace '\.tmp$', '.sql'
$allSql | Out-File -FilePath $tempFile -Encoding UTF8

Write-Host ""
Write-Host "Fichier SQL cree: $tempFile" -ForegroundColor Green
Write-Host ""

# Appliquer via gcloud sql execute-sql
Write-Host "Application des migrations via gcloud sql execute-sql..." -ForegroundColor Yellow
Write-Host ""

$result = gcloud sql execute-sql $InstanceName --database=$DatabaseName --file=$tempFile --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "OK Migrations appliquees avec succes!" -ForegroundColor Green
    Write-Host $result
} else {
    Write-Host ""
    Write-Host "ERREUR lors de l'application des migrations" -ForegroundColor Red
    Write-Host $result
    Write-Host ""
    Write-Host "Alternative: Application manuelle" -ForegroundColor Yellow
    Write-Host "1. Installez Cloud SQL Proxy:" -ForegroundColor White
    Write-Host "   gcloud components install cloud-sql-proxy" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Connectez-vous:" -ForegroundColor White
    Write-Host "   gcloud sql connect $InstanceName --user=yukpo_user --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. Dans psql, executez:" -ForegroundColor White
    Write-Host "   \i $tempFile" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Fichier temporaire: $tempFile" -ForegroundColor Gray


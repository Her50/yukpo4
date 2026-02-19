# Script pour appliquer les migrations directement via gcloud sql execute-sql

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db"
)

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Application Directe des Migrations d'Optimisation SQL" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Lire le fichier SQL combine
$sqlFile = "backend\migrations\20260218_ALL_OPTIMIZATIONS_COMBINED.sql"

if (-not (Test-Path $sqlFile)) {
    Write-Host "ERREUR: Fichier SQL non trouve: $sqlFile" -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $sqlFile -Raw -Encoding UTF8
Write-Host "Fichier SQL lu: $sqlFile" -ForegroundColor Green
Write-Host "Taille: $($sqlContent.Length) caracteres" -ForegroundColor Gray
Write-Host ""

# Diviser le SQL en commandes individuelles (séparées par ;)
# Mais d'abord, essayer d'appliquer le fichier complet via gcloud sql execute-sql
Write-Host "Application via gcloud sql execute-sql..." -ForegroundColor Yellow
Write-Host ""

# Créer un fichier temporaire
$tempFile = [System.IO.Path]::GetTempFileName()
$tempFile = $tempFile -replace '\.tmp$', '.sql'
$sqlContent | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

Write-Host "Fichier temporaire cree: $tempFile" -ForegroundColor Gray
Write-Host ""

# Essayer d'appliquer via gcloud sql execute-sql
Write-Host "Execution de la commande gcloud sql execute-sql..." -ForegroundColor Cyan
$result = gcloud sql execute-sql $InstanceName --database=$DatabaseName --file=$tempFile --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "OK Migrations appliquees avec succes!" -ForegroundColor Green
    Write-Host $result
} else {
    Write-Host ""
    Write-Host "ERREUR lors de l'application via gcloud sql execute-sql" -ForegroundColor Red
    Write-Host "Sortie: $result" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "============================================================================" -ForegroundColor Yellow
    Write-Host "METHODE ALTERNATIVE: Application manuelle" -ForegroundColor Yellow
    Write-Host "============================================================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Via Console Cloud SQL (RECOMMANDE):" -ForegroundColor White
    Write-Host "   https://console.cloud.google.com/sql/instances/$InstanceName/databases" -ForegroundColor Cyan
    Write-Host "   - Cliquez sur '$DatabaseName'" -ForegroundColor White
    Write-Host "   - Onglet 'Query' ou 'SQL Editor'" -ForegroundColor White
    Write-Host "   - Copiez-collez le contenu de: $tempFile" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Ou via psql (si vous avez le mot de passe):" -ForegroundColor White
    Write-Host "   psql -h 34.79.199.41 -U $User -d $DatabaseName -f $tempFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Fichier SQL conserve: $tempFile" -ForegroundColor Gray
}

Write-Host ""


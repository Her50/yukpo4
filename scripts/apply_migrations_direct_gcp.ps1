# Script pour appliquer les migrations directement via API Cloud SQL

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

$sqlContent = Get-Content $sqlFile -Raw

Write-Host "Fichier SQL lu: $sqlFile" -ForegroundColor Green
Write-Host "Taille: $($sqlContent.Length) caracteres" -ForegroundColor Gray
Write-Host ""

# Encoder le SQL en base64 pour l'API
$sqlBytes = [System.Text.Encoding]::UTF8.GetBytes($sqlContent)
$sqlBase64 = [Convert]::ToBase64String($sqlBytes)

# Creer le body JSON pour l'API
$body = @{
    kind = "sql#queryRequest"
    query = $sqlContent
} | ConvertTo-Json -Depth 10

# Sauvegarder dans un fichier temporaire
$tempJson = [System.IO.Path]::GetTempFileName()
$tempJson = $tempJson -replace '\.tmp$', '.json'
$body | Out-File -FilePath $tempJson -Encoding UTF8

Write-Host "Application via API Cloud SQL Admin..." -ForegroundColor Yellow
Write-Host ""

# Essayer d'appliquer via gcloud sql operations
# Note: Cette methode peut ne pas fonctionner directement, mais on peut essayer
Write-Host "Methode 1: Via Console Cloud SQL (RECOMMANDE)" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Ouvrez la console Cloud SQL:" -ForegroundColor White
Write-Host "   https://console.cloud.google.com/sql/instances/$InstanceName/databases" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Cliquez sur la base de donnees '$DatabaseName'" -ForegroundColor White
Write-Host ""
Write-Host "3. Cliquez sur l'onglet 'Query' ou 'SQL Editor'" -ForegroundColor White
Write-Host ""
Write-Host "4. Copiez-collez le contenu du fichier:" -ForegroundColor White
Write-Host "   $sqlFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Cliquez sur 'Run' pour executer" -ForegroundColor White
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Methode 2: Via gcloud sql connect (apres installation Cloud SQL Proxy)" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Installez Cloud SQL Proxy:" -ForegroundColor White
Write-Host "   gcloud components install cloud-sql-proxy" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Connectez-vous:" -ForegroundColor White
Write-Host "   gcloud sql connect $InstanceName --user=yukpo_user --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Dans psql, executez:" -ForegroundColor White
Write-Host "   \i $sqlFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Contenu du fichier SQL:" -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Yellow
Get-Content $sqlFile
Write-Host "============================================================================" -ForegroundColor Yellow



# Analyse des logs backend (1h) pour creation de produit
# Usage: .\scripts\analyser-logs-creation-produit-recent.ps1
# Lancer apres une tentative de creation de produit

param(
    [string]$ProjectId = "yukpo-project",
    [string]$ServiceName = "yukpo-backend",
    [int]$FreshnessMinutes = 60
)

$ErrorActionPreference = "Continue"
$filter = "resource.type=cloud_run_revision AND resource.labels.service_name=" + $ServiceName
$outFile = "logs-creation-1h.json"

Write-Host "Recuperation des logs (dernieres $FreshnessMinutes min)..." -ForegroundColor Cyan
gcloud logging read $filter --limit=400 --project=$ProjectId --format=json --freshness="${FreshnessMinutes}m" 2>&1 | Set-Content -Path $outFile -Encoding UTF8

if (-not (Test-Path $outFile) -or (Get-Item $outFile).Length -lt 10) {
    Write-Host "Aucun log recupere ou fichier vide." -ForegroundColor Yellow
    exit 1
}

$json = Get-Content $outFile -Raw | ConvertFrom-Json
$entries = @($json)

Write-Host ""
Write-Host "=== REQUETES HTTP (URL contenant 'product' ou 'creation') ===" -ForegroundColor Yellow
$count = 0
foreach ($e in $entries) {
    $url = $e.httpRequest.requestUrl
    if (-not $url) { continue }
    if ($url -like "*product*" -or $url -like "*creation*") {
        $count++
        $status = $e.httpRequest.status
        $method = $e.httpRequest.requestMethod
        $ts = $e.timestamp
        $color = if ($status -ge 400) { "Red" } else { "Green" }
        Write-Host "[$ts] $method $status $url" -ForegroundColor $color
    }
}
if ($count -eq 0) {
    Write-Host "Aucune requete vers /product* ou *creation* dans la periode." -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== MESSAGES LOG (process_product, creation, job_id, OPENAI) ===" -ForegroundColor Yellow
$textCount = 0
foreach ($e in $entries) {
    $msg = $e.textPayload
    if (-not $msg) {
        if ($e.jsonPayload -and $e.jsonPayload.message) { $msg = $e.jsonPayload.message }
        else { continue }
    }
    if ($msg -match "process_product|creation.*produit|job_id|OPENAI|creation-service|Produit.*cr") {
        $textCount++
        $ts = $e.timestamp
        Write-Host "[$ts] $($msg.Substring(0, [Math]::Min(200, $msg.Length)))..." -ForegroundColor Gray
    }
}
if ($textCount -eq 0) {
    Write-Host "Aucun message de creation produit/IA dans les logs texte." -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== ERREURS HTTP (4xx/5xx) ===" -ForegroundColor Yellow
$errCount = 0
foreach ($e in $entries) {
    $status = $e.httpRequest.status
    if ($status -ge 400) {
        $errCount++
        $url = $e.httpRequest.requestUrl
        Write-Host "  $status $url" -ForegroundColor Red
    }
}
if ($errCount -eq 0) {
    Write-Host "Aucune erreur HTTP dans la periode." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Fichier complet: $outFile" -ForegroundColor Cyan
Write-Host "Total entrees: $($entries.Count)" -ForegroundColor Cyan

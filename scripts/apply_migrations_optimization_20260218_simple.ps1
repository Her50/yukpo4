# Script simplifie pour appliquer les migrations d'optimisation SQL (18/02/2026)

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user"
)

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Application des Migrations d'Optimisation SQL (18/02/2026)" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: gcloud CLI n'est pas installe!" -ForegroundColor Red
    Write-Host "   Installez-le depuis: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Créer un fichier temporaire avec toutes les migrations combinées
Write-Host "[1/3] Preparation des migrations..." -ForegroundColor Yellow
$tempFile = [System.IO.Path]::GetTempFileName()
$tempFile = $tempFile -replace '\.tmp$', '.sql'

$migrations = @(
    "backend\migrations\20260218_optimize_delivery_matching_queue_final.sql",
    "backend\migrations\20260218_optimize_delivery_proximity_suggestions.sql",
    "backend\migrations\20260218_optimize_product_orders_validation_deadline.sql"
)

$combinedContent = @"
-- ============================================================================
-- Migrations d'Optimisation SQL Combinees (18/02/2026)
-- Appliquees automatiquement via script PowerShell
-- ============================================================================

"@

foreach ($migration in $migrations) {
    if (Test-Path $migration) {
        Write-Host "   OK Ajout: $migration" -ForegroundColor Green
        $content = Get-Content $migration -Raw
        $combinedContent += "`n-- Migration: $migration`n"
        $combinedContent += $content
        $combinedContent += "`n`n"
    } else {
        Write-Host "   ATTENTION Fichier non trouve: $migration" -ForegroundColor Yellow
    }
}

$combinedContent | Out-File -FilePath $tempFile -Encoding UTF8
Write-Host "OK Fichier temporaire cree: $tempFile" -ForegroundColor Green
Write-Host ""

Write-Host "[2/3] Instructions pour application manuelle..." -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Connectez-vous a Cloud SQL:" -ForegroundColor White
Write-Host "   gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Dans psql, executez:" -ForegroundColor White
Write-Host "   \i $tempFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "   OU copiez-collez le contenu du fichier ci-dessous:" -ForegroundColor White
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Yellow
Get-Content $tempFile
Write-Host "============================================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "[3/3] Fichier temporaire conserve: $tempFile" -ForegroundColor Gray
Write-Host ""


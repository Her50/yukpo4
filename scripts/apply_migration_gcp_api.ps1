# Script pour appliquer la migration via l'API REST Cloud SQL
# Utilise l'authentification gcloud pour eviter de demander le mot de passe

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user"
)

Write-Host "Application de la migration via API Cloud SQL..." -ForegroundColor Cyan
Write-Host ""

# Verifier que gcloud est disponible
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: gcloud non trouve" -ForegroundColor Red
    exit 1
}

# Verifier l'authentification
$account = gcloud config get-value account 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Non authentifie avec gcloud" -ForegroundColor Red
    Write-Host "Executez: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK Authentifie en tant que: $account" -ForegroundColor Green
gcloud config set project $ProjectId 2>&1 | Out-Null
Write-Host "OK Projet configure: $ProjectId" -ForegroundColor Green
Write-Host ""

# Lire le fichier SQL
$sqlFile = Join-Path $PSScriptRoot "..\backend\migrations\20260216_fix_duplicate_full_names.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "ERREUR: Fichier non trouve: $sqlFile" -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $sqlFile -Raw -Encoding UTF8
Write-Host "OK Fichier SQL lu ($($sqlContent.Length) caracteres)" -ForegroundColor Green
Write-Host ""

# Diviser en statements individuels pour execution separee
# (car l'API Cloud SQL peut avoir des limites de taille)
$statements = $sqlContent -split '(?<=;)\s*\n' | Where-Object { 
    $_.Trim() -ne '' -and 
    $_.Trim() -notmatch '^--' -and
    $_.Trim() -notmatch '^\s*$'
}

Write-Host "Nombre de statements SQL: $($statements.Count)" -ForegroundColor Cyan
Write-Host ""

# Methode: Utiliser gcloud sql connect avec un script automatise
# Creer un script SQL qui execute tout
$tempScript = [System.IO.Path]::GetTempFileName()
$tempScript = $tempScript -replace '\.tmp$', '.sql'

$fullScript = @"
\set ON_ERROR_STOP on
\echo 'Debut de la migration...'
$sqlContent
\echo 'Migration terminee avec succes!'
"@

$fullScript | Out-File -FilePath $tempScript -Encoding UTF8 -NoNewline

Write-Host "Fichier script cree: $tempScript" -ForegroundColor Gray
Write-Host ""

# Instructions pour execution
Write-Host "INSTRUCTIONS POUR APPLIQUER LA MIGRATION:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Via Console Cloud SQL (RECOMMANDE)" -ForegroundColor Cyan
Write-Host "1. Ouvrez: https://console.cloud.google.com/sql/instances/$InstanceName/databases?project=$ProjectId" -ForegroundColor White
Write-Host "2. Cliquez sur la base de donnees '$DatabaseName'" -ForegroundColor White
Write-Host "3. Cliquez sur 'Query' ou 'SQL Editor'" -ForegroundColor White
Write-Host "4. Copiez-collez le contenu du fichier:" -ForegroundColor White
Write-Host "   $sqlFile" -ForegroundColor Gray
Write-Host "5. Cliquez sur 'Run'" -ForegroundColor White
Write-Host ""

Write-Host "Option 2: Via gcloud sql connect (necessite mot de passe)" -ForegroundColor Cyan
Write-Host "1. Executez:" -ForegroundColor White
Write-Host "   gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Yellow
Write-Host "2. Dans psql, executez:" -ForegroundColor White
Write-Host "   \i $tempScript" -ForegroundColor Yellow
Write-Host ""

Write-Host "Option 3: Via Cloud SQL Proxy + psql" -ForegroundColor Cyan
Write-Host "1. Demarrez Cloud SQL Proxy:" -ForegroundColor White
Write-Host "   cloud-sql-proxy $ProjectId`:europe-west1`:$InstanceName --port=5433" -ForegroundColor Yellow
Write-Host "2. Dans un autre terminal, executez:" -ForegroundColor White
Write-Host "   Get-Content `"$tempScript`" | psql postgresql://$User@localhost:5433/$DatabaseName" -ForegroundColor Yellow
Write-Host ""

# Afficher le contenu SQL pour copier-coller
Write-Host "CONTENU SQL A COPIER-COLLER:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Gray
Write-Host $sqlContent -ForegroundColor White
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

Write-Host "OK Script termine" -ForegroundColor Green
Write-Host "Fichier temporaire: $tempScript" -ForegroundColor Gray



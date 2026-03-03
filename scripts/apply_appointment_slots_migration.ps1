# Script pour appliquer la migration appointment_slots sur Cloud SQL GCP
# Usage: .\scripts\apply_appointment_slots_migration.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user"
)

Write-Host ""
Write-Host "=== Migration: appointment_slots ===" -ForegroundColor Yellow
Write-Host "Cible: Cloud SQL GCP ($InstanceName / $DatabaseName)" -ForegroundColor Cyan
Write-Host ""

# Vérifier gcloud
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: gcloud CLI non installe" -ForegroundColor Red
    exit 1
}

# Vérifier authentification
$authStatus = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authStatus) {
    Write-Host "ERREUR: Non authentifie. Executez: gcloud auth login" -ForegroundColor Red
    exit 1
}
Write-Host "OK Authentifie: $authStatus" -ForegroundColor Green

# Configurer le projet
gcloud config set project $ProjectId 2>&1 | Out-Null
Write-Host "OK Projet: $ProjectId" -ForegroundColor Green

# Lire le fichier SQL
$migrationFile = Join-Path $PSScriptRoot "..\backend\migrations\20260303_create_appointment_slots.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "ERREUR: Fichier migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $migrationFile -Raw -Encoding UTF8
Write-Host "OK Migration chargee ($($sqlContent.Length) caracteres)" -ForegroundColor Green
Write-Host ""

# Vérifier si Cloud SQL Proxy est disponible
$proxyAvailable = Get-Command cloud-sql-proxy -ErrorAction SilentlyContinue
$psqlAvailable = Get-Command psql -ErrorAction SilentlyContinue

if ($proxyAvailable -and $psqlAvailable) {
    Write-Host "Cloud SQL Proxy et psql detectes - Application automatique..." -ForegroundColor Cyan
    Write-Host ""

    # Demander le mot de passe
    $securePassword = Read-Host "Mot de passe pour $User" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

    $connectionName = "${ProjectId}:${Region}:${InstanceName}"
    $proxyPort = 5433

    Write-Host "Demarrage Cloud SQL Proxy ($connectionName sur port $proxyPort)..." -ForegroundColor Cyan
    $proxyProcess = Start-Process -FilePath "cloud-sql-proxy" -ArgumentList "$connectionName", "--port=$proxyPort" -PassThru -WindowStyle Hidden

    Start-Sleep -Seconds 5

    $env:PGPASSWORD = $Password
    $connectionString = "postgresql://${User}:${Password}@localhost:${proxyPort}/${DatabaseName}"

    Write-Host "Application de la migration..." -ForegroundColor Cyan
    Write-Host ""
    $result = $sqlContent | & psql $connectionString 2>&1
    $exitCode = $LASTEXITCODE

    Write-Host $result

    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "OK Migration appliquee avec succes!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "ERREUR lors de l'application ($exitCode)" -ForegroundColor Red
    }

    # Cleanup
    Stop-Process -Id $proxyProcess.Id -Force -ErrorAction SilentlyContinue
    $env:PGPASSWORD = $null
    $Password = $null

} elseif ($psqlAvailable) {
    Write-Host "psql detecte mais pas Cloud SQL Proxy" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Installer Cloud SQL Proxy:" -ForegroundColor Cyan
    Write-Host "  https://cloud.google.com/sql/docs/postgres/sql-proxy" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Utiliser gcloud sql connect:" -ForegroundColor Cyan
    Write-Host "  gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Yellow
    Write-Host "  Puis dans psql:" -ForegroundColor White
    Write-Host "  \i $migrationFile" -ForegroundColor Yellow

} else {
    Write-Host "Ni psql ni Cloud SQL Proxy disponibles" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "=== METHODE RECOMMANDEE: Console Cloud SQL ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Ouvrez:" -ForegroundColor White
    Write-Host "   https://console.cloud.google.com/sql/instances/$InstanceName/databases?project=$ProjectId" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "2. Cliquez sur Cloud SQL Studio ou ouvrez Cloud Shell" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Copiez-collez le SQL ci-dessous:" -ForegroundColor White
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Gray
    Write-Host $sqlContent -ForegroundColor White
    Write-Host "========================================" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Script termine." -ForegroundColor Green

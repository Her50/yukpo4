# Applique backend/migrations/20260324_programmes_scolaires_etablissement_id.sql sur Cloud SQL (GCP)
# Prerequis: gcloud auth login, droits Cloud SQL Client / instance
#
# Usage:
#   .\scripts\apply_programmes_scolaires_etablissement_id_gcp.ps1
#   .\scripts\apply_programmes_scolaires_etablissement_id_gcp.ps1 -Password "secret"
#   $env:PGPASSWORD = "secret"; .\scripts\apply_programmes_scolaires_etablissement_id_gcp.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Password = "",
    [string]$DatabaseUrl = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$sqlPath = Join-Path $repoRoot "backend\migrations\20260324_programmes_scolaires_etablissement_id.sql"

if (-not (Test-Path $sqlPath)) {
    Write-Host "Fichier SQL introuvable: $sqlPath" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "gcloud CLI introuvable." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "psql introuvable. Installez PostgreSQL client ou utilisez Cloud Shell." -ForegroundColor Red
    exit 1
}

gcloud config set project $ProjectId 2>&1 | Out-Null

Write-Host "SQL: $sqlPath" -ForegroundColor Gray

$url = $DatabaseUrl
if ([string]::IsNullOrWhiteSpace($url)) { $url = $env:DATABASE_URL }

if (-not [string]::IsNullOrWhiteSpace($url)) {
    $url = $url.Trim()
    Write-Host "Connexion via DATABASE_URL (param ou env)." -ForegroundColor Cyan
    & psql -d $url -v ON_ERROR_STOP=1 -f $sqlPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Echec psql (code $LASTEXITCODE)." -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host "Migration appliquee avec succes." -ForegroundColor Green
    exit 0
}

Write-Host "Projet: $ProjectId | Instance: $InstanceName | Base: $DatabaseName | Utilisateur: $User" -ForegroundColor Cyan
Write-Host "Astuce: definissez `$env:DATABASE_URL ou passez -DatabaseUrl pour eviter IP/mot de passe manuels." -ForegroundColor DarkGray

if ([string]::IsNullOrWhiteSpace($Password) -and [string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
    $securePassword = Read-Host "Mot de passe PostgreSQL (utilisateur $User)" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    $env:PGPASSWORD = $Password
} elseif (-not [string]::IsNullOrWhiteSpace($Password)) {
    $env:PGPASSWORD = $Password
}

$instanceJson = gcloud sql instances describe $InstanceName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json
if (-not $instanceJson) {
    Write-Host "Instance introuvable: $InstanceName" -ForegroundColor Red
    exit 1
}

$publicIp = $instanceJson.settings.ipConfiguration.ipAddresses | Where-Object { $_.type -eq "PRIMARY" } | Select-Object -ExpandProperty ipAddress
if ([string]::IsNullOrWhiteSpace($publicIp)) {
    Write-Host "IP publique PRIMARY introuvable. Verifiez l'acces reseau (IP autorisee / VPN)." -ForegroundColor Red
    exit 1
}

Write-Host "Connexion psql: $User@${publicIp}:5432/$DatabaseName" -ForegroundColor Yellow

& psql -h $publicIp -U $User -d $DatabaseName -p 5432 -v ON_ERROR_STOP=1 --set=sslmode=require -f $sqlPath 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Echec psql (code $LASTEXITCODE)." -ForegroundColor Red
    $env:PGPASSWORD = $null
    exit $LASTEXITCODE
}

Write-Host "Migration appliquee avec succes." -ForegroundColor Green
$env:PGPASSWORD = $null
exit 0

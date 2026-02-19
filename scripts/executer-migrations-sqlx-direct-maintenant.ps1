# Script pour exécuter les migrations SQLx MAINTENANT via cargo sqlx migrate run
# Date: 2026-02-15
# Objectif: Exécuter les migrations SQLx au moins une fois pour créer les tables de base

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Password = ""
)

Write-Host "Execution Migrations SQLx MAINTENANT" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Verifier que gcloud est installe
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path "$gcloudPath\gcloud.cmd") {
    $env:Path += ";$gcloudPath"
    Write-Host "[OK] gcloud ajoute au PATH" -ForegroundColor Green
} else {
    Write-Host "[ERREUR] gcloud non trouve" -ForegroundColor Red
    exit 1
}

# Verifier que cargo est disponible
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "[ERREUR] cargo non trouve" -ForegroundColor Red
    Write-Host "[INFO] Installez Rust: https://www.rust-lang.org/tools/install" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] cargo trouve" -ForegroundColor Green
Write-Host ""

# Recuperer l'IP publique Cloud SQL
Write-Host "[ETAPE 1/4] Recuperation IP publique Cloud SQL..." -ForegroundColor Yellow

$publicIp = gcloud sql instances describe $InstanceName --format="get(ipAddresses[0].ipAddress)" --project=$ProjectId 2>&1

if ($LASTEXITCODE -ne 0 -or -not $publicIp) {
    Write-Host "   [ERREUR] Impossible de recuperer l'IP publique" -ForegroundColor Red
    exit 1
}

Write-Host "   [OK] IP publique: $publicIp" -ForegroundColor Green
Write-Host ""

# Demander le mot de passe si non fourni
if ([string]::IsNullOrEmpty($Password)) {
    Write-Host "[ETAPE 2/4] Authentification..." -ForegroundColor Yellow
    Write-Host "   [INFO] Mot de passe requis pour $User" -ForegroundColor Cyan
    $securePassword = Read-Host "   Entrez le mot de passe" -AsSecureString
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
    Write-Host ""
}

# Construire DATABASE_URL
$databaseUrl = "postgresql://${User}:${Password}@${publicIp}:5432/${DatabaseName}?sslmode=require"

Write-Host "[ETAPE 3/4] Configuration DATABASE_URL..." -ForegroundColor Yellow
$env:DATABASE_URL = $databaseUrl
Write-Host "   [OK] DATABASE_URL configuree" -ForegroundColor Green
Write-Host ""

# Verifier/Installer sqlx-cli
Write-Host "[ETAPE 4/4] Verification sqlx-cli..." -ForegroundColor Yellow

$sqlxAvailable = $false
try {
    $sqlxVersion = cargo sqlx --version 2>&1
    if ($sqlxVersion) {
        $sqlxAvailable = $true
        Write-Host "   [OK] sqlx-cli trouve: $sqlxVersion" -ForegroundColor Green
    }
} catch {
    $sqlxAvailable = $false
}

if (-not $sqlxAvailable) {
    Write-Host "   [INFO] sqlx-cli non trouve, installation..." -ForegroundColor Yellow
    Write-Host "   [INFO] Cela peut prendre 5-10 minutes..." -ForegroundColor Cyan
    Write-Host ""
    
    cargo install sqlx-cli --version 0.8.6 --no-default-features --features postgres --locked
    
    if ($LASTEXITCODE -eq 0) {
        $sqlxAvailable = $true
        Write-Host "   [OK] sqlx-cli installe" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Impossible d'installer sqlx-cli" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Changer vers le dossier backend
Push-Location backend

# Executer les migrations
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EXECUTION DES MIGRATIONS SQLX" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[INFO] Execution des migrations SQLx..." -ForegroundColor Yellow
Write-Host "[INFO] Cela peut prendre plusieurs minutes..." -ForegroundColor Cyan
Write-Host "[INFO] Les migrations seront appliquees dans l'ordre..." -ForegroundColor Cyan
Write-Host ""

# Executer les migrations
cargo sqlx migrate run

$migrationExitCode = $LASTEXITCODE

Pop-Location

# Nettoyer le mot de passe
$Password = $null
$securePassword = $null
$env:DATABASE_URL = $null

Write-Host ""
if ($migrationExitCode -eq 0) {
    Write-Host "[OK] Migrations SQLx executees avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaines etapes:" -ForegroundColor Cyan
    Write-Host "   1. Verifier que les tables ont ete creees:" -ForegroundColor White
    Write-Host "      gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
    Write-Host "      SELECT COUNT(*) FROM _sqlx_migrations;" -ForegroundColor Cyan
    Write-Host "   2. Verifier les tables principales:" -ForegroundColor White
    Write-Host "      \dt" -ForegroundColor Cyan
    Write-Host "   3. Activer ENABLE_SQLX_MIGRATIONS=true dans Cloud Run (deja fait)" -ForegroundColor White
} else {
    Write-Host "[ERREUR] Erreur lors de l'execution des migrations (code: $migrationExitCode)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifications:" -ForegroundColor Yellow
    Write-Host "   1. Verifier que l'IP publique est autorisee dans Cloud SQL" -ForegroundColor White
    Write-Host "   2. Verifier le mot de passe" -ForegroundColor White
    Write-Host "   3. Verifier la connectivite:" -ForegroundColor White
    Write-Host "      psql `"$databaseUrl`" -c `"SELECT 1;`"" -ForegroundColor Cyan
}

Write-Host ""




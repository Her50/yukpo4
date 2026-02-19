# Script complet pour exécuter les migrations SQLx
# Date: 2026-02-15
# Objectif: Exécuter les migrations SQLx avec autorisation IP automatique

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Password = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EXECUTION MIGRATIONS SQLX COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
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
    exit 1
}

Write-Host "[OK] cargo trouve" -ForegroundColor Green
Write-Host ""

# Etape 1: Recuperer l'IP publique Cloud SQL
Write-Host "[ETAPE 1/5] Recuperation IP publique Cloud SQL..." -ForegroundColor Yellow
$publicIp = gcloud sql instances describe $InstanceName --format="get(ipAddresses[0].ipAddress)" --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0 -or -not $publicIp) {
    Write-Host "   [ERREUR] Impossible de recuperer l'IP publique" -ForegroundColor Red
    exit 1
}
Write-Host "   [OK] IP publique: $publicIp" -ForegroundColor Green
Write-Host ""

# Etape 2: Recuperer l'IP publique locale
Write-Host "[ETAPE 2/5] Recuperation IP publique locale..." -ForegroundColor Yellow
try {
    $localIp = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 5).Content.Trim()
    Write-Host "   [OK] IP locale: $localIp" -ForegroundColor Green
} catch {
    Write-Host "   [ATTENTION] Impossible de recuperer l'IP locale" -ForegroundColor Yellow
    $localIp = Read-Host "   Entrez votre IP publique manuellement"
}
Write-Host ""

# Etape 3: Autoriser l'IP dans Cloud SQL
Write-Host "[ETAPE 3/5] Autorisation IP dans Cloud SQL..." -ForegroundColor Yellow
Write-Host "   [INFO] Ajout de l'IP $localIp/32 aux reseaux autorises..." -ForegroundColor Cyan

# Recuperer les reseaux autorises actuels
$currentNetworks = gcloud sql instances describe $InstanceName --format="get(settings.ipConfiguration.authorizedNetworks)" --project=$ProjectId 2>&1

# Ajouter l'IP si elle n'est pas deja autorisee
$addNetwork = $true
if ($currentNetworks -match $localIp) {
    Write-Host "   [OK] IP deja autorisee" -ForegroundColor Green
    $addNetwork = $false
} else {
    gcloud sql instances patch $InstanceName --authorized-networks=$localIp/32 --project=$ProjectId 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] IP autorisee avec succes" -ForegroundColor Green
    } else {
        Write-Host "   [ATTENTION] Erreur lors de l'autorisation (peut-etre deja autorisee)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Etape 4: Demander le mot de passe si non fourni
Write-Host "[ETAPE 4/5] Authentification..." -ForegroundColor Yellow
if ([string]::IsNullOrEmpty($Password)) {
    Write-Host "   [INFO] Mot de passe requis pour $User" -ForegroundColor Cyan
    $securePassword = Read-Host "   Entrez le mot de passe" -AsSecureString
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
} else {
    Write-Host "   [OK] Mot de passe fourni en parametre" -ForegroundColor Green
}
Write-Host ""

# Etape 5: Executer les migrations
Write-Host "[ETAPE 5/5] Execution des migrations SQLx..." -ForegroundColor Yellow

# Construire DATABASE_URL
$databaseUrl = "postgresql://${User}:${Password}@${publicIp}:5432/${DatabaseName}?sslmode=require"
$env:DATABASE_URL = $databaseUrl

Write-Host "   [INFO] Configuration DATABASE_URL..." -ForegroundColor Cyan
Write-Host "   [INFO] Execution via cargo sqlx migrate run..." -ForegroundColor Cyan
Write-Host "   [INFO] Cela peut prendre plusieurs minutes..." -ForegroundColor Yellow
Write-Host ""

# Changer vers le dossier backend
Push-Location backend

# Executer les migrations
cargo sqlx migrate run

$migrationExitCode = $LASTEXITCODE

Pop-Location

# Nettoyer
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
    Write-Host "   2. Les migrations automatiques prendront le relais pour les futures migrations" -ForegroundColor White
} else {
    Write-Host "[ERREUR] Erreur lors de l'execution des migrations (code: $migrationExitCode)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifications:" -ForegroundColor Yellow
    Write-Host "   1. Verifier que l'IP publique est bien autorisee dans Cloud SQL" -ForegroundColor White
    Write-Host "   2. Verifier le mot de passe" -ForegroundColor White
    Write-Host "   3. Verifier la connectivite:" -ForegroundColor White
    Write-Host "      Test-NetConnection -ComputerName $publicIp -Port 5432" -ForegroundColor Cyan
}

Write-Host ""




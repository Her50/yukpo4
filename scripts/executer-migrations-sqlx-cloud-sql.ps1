# Script pour exécuter les migrations SQLx directement sur Cloud SQL PostgreSQL
# Date: 2026-02-15
# Objectif: Exécuter les migrations SQLx au moins une fois pour créer les tables de base

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user"
)

Write-Host "Execution Migrations SQLx Cloud SQL" -ForegroundColor Cyan
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

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "   Projet GCP: $ProjectId"
Write-Host "   Region: $Region"
Write-Host "   Instance: $InstanceName"
Write-Host "   Database: $DatabaseName"
Write-Host "   User: $User"
Write-Host ""

# Etape 1: Recuperer les informations de connexion
Write-Host "[ETAPE 1/3] Recuperation informations Cloud SQL..." -ForegroundColor Yellow

$connectionName = "$ProjectId`:$Region`:$InstanceName"
Write-Host "   [OK] Connection Name: $connectionName" -ForegroundColor Green

# Etape 2: Instructions pour executer les migrations
Write-Host "[ETAPE 2/3] Instructions execution migrations..." -ForegroundColor Yellow
Write-Host ""
Write-Host "   Pour executer les migrations SQLx, vous avez 2 options:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   OPTION 1: Via gcloud sql connect (Recommandee)" -ForegroundColor Yellow
Write-Host "   ================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "   1. Connectez-vous a Cloud SQL:" -ForegroundColor White
Write-Host "      gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
Write-Host ""
Write-Host "   2. Dans psql, executez les migrations dans l'ordre:" -ForegroundColor White
Write-Host "      \i backend/migrations/00000001_create_extensions.sql" -ForegroundColor Cyan
Write-Host "      \i backend/migrations/00000002_create_base_tables.sql" -ForegroundColor Cyan
Write-Host "      \i backend/migrations/00000003_create_utility_tables.sql" -ForegroundColor Cyan
Write-Host "      ... (et ainsi de suite pour toutes les migrations)" -ForegroundColor Cyan
Write-Host ""
Write-Host "   OPTION 2: Via cargo sqlx migrate run (depuis machine locale avec acces)" -ForegroundColor Yellow
Write-Host "   ==========================================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "   1. Installer sqlx-cli:" -ForegroundColor White
Write-Host "      cargo install sqlx-cli --version 0.8.6 --no-default-features --features postgres" -ForegroundColor Cyan
Write-Host ""
Write-Host "   2. Configurer DATABASE_URL:" -ForegroundColor White
Write-Host "      `$env:DATABASE_URL='postgresql://$User:PASSWORD@PUBLIC_IP:5432/$DatabaseName?sslmode=require'" -ForegroundColor Cyan
Write-Host ""
Write-Host "   3. Executer les migrations:" -ForegroundColor White
Write-Host "      cd backend" -ForegroundColor Cyan
Write-Host "      cargo sqlx migrate run" -ForegroundColor Cyan
Write-Host ""

# Etape 3: Recuperer l'IP publique pour option 2
Write-Host "[ETAPE 3/3] Recuperation IP publique Cloud SQL..." -ForegroundColor Yellow

$publicIp = gcloud sql instances describe $InstanceName --region=$Region --format="get(ipAddresses[0].ipAddress)" --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0 -and $publicIp) {
    Write-Host "   [OK] IP publique: $publicIp" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Format DATABASE_URL pour option 2:" -ForegroundColor Cyan
    Write-Host "   postgresql://$User:PASSWORD@$publicIp:5432/$DatabaseName?sslmode=require" -ForegroundColor White
} else {
    Write-Host "   [ATTENTION] Impossible de recuperer l'IP publique" -ForegroundColor Yellow
    Write-Host "   [INFO] Utilisez l'option 1 (gcloud sql connect)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "[OK] Instructions generees!" -ForegroundColor Green
Write-Host ""
Write-Host "Recommandation:" -ForegroundColor Yellow
Write-Host "   Utilisez l'OPTION 1 (gcloud sql connect) pour executer les migrations" -ForegroundColor White
Write-Host "   C'est la methode la plus simple et la plus securisee" -ForegroundColor White
Write-Host ""



# Script pour exécuter les migrations SQLx MAINTENANT sur Cloud SQL
# Date: 2026-02-15
# Objectif: Exécuter les migrations SQLx au moins une fois pour créer les tables de base

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user"
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

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "   Projet GCP: $ProjectId"
Write-Host "   Region: $Region"
Write-Host "   Instance: $InstanceName"
Write-Host "   Database: $DatabaseName"
Write-Host "   User: $User"
Write-Host ""

# Option 1: Utiliser cargo sqlx migrate run (si disponible)
Write-Host "[OPTION 1] Execution via cargo sqlx migrate run..." -ForegroundColor Yellow
Write-Host ""

# Verifier si cargo est disponible
$cargoAvailable = $false
try {
    $cargoVersion = cargo --version 2>&1
    if ($cargoVersion) {
        $cargoAvailable = $true
        Write-Host "   [OK] cargo trouve" -ForegroundColor Green
    }
} catch {
    $cargoAvailable = $false
}

if ($cargoAvailable) {
    # Recuperer l'IP publique Cloud SQL
    Write-Host "   [INFO] Recuperation IP publique Cloud SQL..." -ForegroundColor Cyan
    $publicIp = gcloud sql instances describe $InstanceName --format="get(ipAddresses[0].ipAddress)" --project=$ProjectId 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $publicIp) {
        Write-Host "   [OK] IP publique: $publicIp" -ForegroundColor Green
        
        # Demander le mot de passe
        Write-Host ""
        Write-Host "   [INFO] Mot de passe requis pour $User" -ForegroundColor Yellow
        $securePassword = Read-Host "   Entrez le mot de passe" -AsSecureString
        $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
        
        # Construire DATABASE_URL
        $databaseUrl = "postgresql://${User}:${password}@${publicIp}:5432/${DatabaseName}?sslmode=require"
        
        Write-Host ""
        Write-Host "   [INFO] Configuration DATABASE_URL..." -ForegroundColor Cyan
        $env:DATABASE_URL = $databaseUrl
        
        Write-Host "   [INFO] Execution des migrations SQLx..." -ForegroundColor Cyan
        Write-Host "   [INFO] Cela peut prendre plusieurs minutes..." -ForegroundColor Yellow
        Write-Host ""
        
        # Changer vers le dossier backend
        Push-Location backend
        
        # Verifier si sqlx-cli est installe
        $sqlxAvailable = $false
        try {
            $sqlxVersion = cargo sqlx --version 2>&1
            if ($sqlxVersion) {
                $sqlxAvailable = $true
                Write-Host "   [OK] sqlx-cli trouve" -ForegroundColor Green
            }
        } catch {
            Write-Host "   [ATTENTION] sqlx-cli non trouve, installation..." -ForegroundColor Yellow
            Write-Host "   [INFO] Installation de sqlx-cli (cela peut prendre 5-10 minutes)..." -ForegroundColor Cyan
            cargo install sqlx-cli --version 0.8.6 --no-default-features --features postgres --locked
            if ($LASTEXITCODE -eq 0) {
                $sqlxAvailable = $true
            }
        }
        
        if ($sqlxAvailable) {
            Write-Host ""
            Write-Host "   [INFO] Execution des migrations..." -ForegroundColor Cyan
            cargo sqlx migrate run
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "   [OK] Migrations SQLx executees avec succes!" -ForegroundColor Green
            } else {
                Write-Host ""
                Write-Host "   [ERREUR] Erreur lors de l'execution des migrations" -ForegroundColor Red
            }
        } else {
            Write-Host "   [ERREUR] Impossible d'installer sqlx-cli" -ForegroundColor Red
        }
        
        Pop-Location
        
        # Nettoyer le mot de passe
        $password = $null
        $securePassword = $null
    } else {
        Write-Host "   [ERREUR] Impossible de recuperer l'IP publique" -ForegroundColor Red
        Write-Host "   [INFO] Utilisez l'option 2 (gcloud sql connect)" -ForegroundColor Cyan
    }
} else {
    Write-Host "   [ATTENTION] cargo non disponible" -ForegroundColor Yellow
    Write-Host "   [INFO] Utilisez l'option 2 (gcloud sql connect)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "[OPTION 2] Execution via gcloud sql connect (Alternative)" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Si l'option 1 n'a pas fonctionne, utilisez:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   1. Connectez-vous a Cloud SQL:" -ForegroundColor White
Write-Host "      gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
Write-Host ""
Write-Host "   2. Dans psql, executez:" -ForegroundColor White
Write-Host "      SELECT COUNT(*) FROM _sqlx_migrations;" -ForegroundColor Cyan
Write-Host ""
Write-Host "   3. Si la table est vide, executez les migrations principales:" -ForegroundColor White
Write-Host "      \i backend/migrations/00000001_create_extensions.sql" -ForegroundColor Cyan
Write-Host "      \i backend/migrations/00000002_create_base_tables.sql" -ForegroundColor Cyan
Write-Host "      ... (et ainsi de suite)" -ForegroundColor Cyan
Write-Host ""

Write-Host "[OK] Instructions generees!" -ForegroundColor Green
Write-Host ""




# Script pour Configurer les Credentials Cloud Storage pour l'API S3 Compatible
# Usage: .\scripts\configure-cloud-storage-credentials.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$ServiceAccountEmail = "cloud-storage-sa@yukpo-project.iam.gserviceaccount.com"
)

$ErrorActionPreference = "Stop"

Write-Host "Configuration des Credentials Cloud Storage" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Mettre a jour le PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$gcloudPath = "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path $gcloudPath) {
    $env:PATH += ";$gcloudPath"
}

# Configurer le projet
gcloud config set project $ProjectId 2>&1 | Out-Null

Write-Host "Projet configure: $ProjectId" -ForegroundColor Green
Write-Host "Service Account: $ServiceAccountEmail" -ForegroundColor Green
Write-Host ""

# IMPORTANT: Cloud Storage avec API S3 compatible utilise des credentials HMAC
# Ces credentials sont différents des clés JSON de service account
# Il faut créer des credentials HMAC spécifiquement pour l'API S3

Write-Host "ATTENTION: Cloud Storage avec API S3 compatible" -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Le SDK aws_sdk_s3 utilise des credentials HMAC (access_key/secret_key)" -ForegroundColor White
Write-Host "Cloud Storage supporte l'API S3 compatible mais nécessite des credentials HMAC" -ForegroundColor White
Write-Host ""
Write-Host "Options:" -ForegroundColor Cyan
Write-Host "  1. Créer des credentials HMAC pour le service account" -ForegroundColor White
Write-Host "  2. OU utiliser Application Default Credentials (nécessite modification du code)" -ForegroundColor White
Write-Host "  3. OU migrer vers google-cloud-storage SDK (nécessite modification du code)" -ForegroundColor White
Write-Host ""

# Option 1: Créer des credentials HMAC
Write-Host "Option 1: Créer des credentials HMAC" -ForegroundColor Yellow
Write-Host "====================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pour créer des credentials HMAC pour Cloud Storage:" -ForegroundColor White
Write-Host "  1. Allez sur: https://console.cloud.google.com/storage/settings" -ForegroundColor Gray
Write-Host "  2. Onglet 'Interoperability'" -ForegroundColor Gray
Write-Host "  3. Cliquez sur 'Create a key for a service account'" -ForegroundColor Gray
Write-Host "  4. Sélectionnez: $ServiceAccountEmail" -ForegroundColor Gray
Write-Host "  5. Copiez l'Access Key et Secret Key générés" -ForegroundColor Gray
Write-Host ""

# Option 2: Utiliser Application Default Credentials
Write-Host "Option 2: Utiliser Application Default Credentials (Recommandé)" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Sur Cloud Run, le service account est automatiquement disponible via ADC." -ForegroundColor White
Write-Host "Il faut modifier MediaStorageService pour utiliser ADC au lieu de credentials explicites." -ForegroundColor White
Write-Host ""
Write-Host "Modification requise dans backend/src/services/media_storage_service.rs:" -ForegroundColor Cyan
Write-Host "  - Détecter si S3_ENDPOINT contient 'storage.googleapis.com'" -ForegroundColor Gray
Write-Host "  - Si oui, utiliser Application Default Credentials" -ForegroundColor Gray
Write-Host "  - OU migrer vers google-cloud-storage SDK" -ForegroundColor Gray
Write-Host ""

# Option 3: Créer une clé JSON pour développement local
Write-Host "Option 3: Clé JSON pour développement local" -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host ""

$keyFile = "cloud-storage-sa-key.json"
if (Test-Path $keyFile) {
    Write-Host "Clé JSON existe déjà: $keyFile" -ForegroundColor Green
} else {
    Write-Host "Création de la clé JSON pour développement local..." -ForegroundColor Yellow
    gcloud iam service-accounts keys create $keyFile `
        --iam-account=$ServiceAccountEmail `
        --project=$ProjectId 2>&1 | Out-Null
    
    if (Test-Path $keyFile) {
        Write-Host "Clé JSON créée: $keyFile" -ForegroundColor Green
        Write-Host ""
        Write-Host "ATTENTION: Cette clé JSON ne peut pas être utilisée directement avec aws_sdk_s3" -ForegroundColor Yellow
        Write-Host "Il faut soit:" -ForegroundColor Yellow
        Write-Host "  - Créer des credentials HMAC (Option 1)" -ForegroundColor White
        Write-Host "  - OU modifier le code pour utiliser ADC (Option 2)" -ForegroundColor White
    } else {
        Write-Host "ERREUR: Impossible de créer la clé JSON" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Résumé:" -ForegroundColor Cyan
Write-Host "  - Pour Cloud Run: Utiliser ADC (Option 2 - Recommandé)" -ForegroundColor White
Write-Host "  - Pour développement local: Créer credentials HMAC (Option 1)" -ForegroundColor White
Write-Host "  - OU migrer vers google-cloud-storage SDK" -ForegroundColor White
Write-Host ""

